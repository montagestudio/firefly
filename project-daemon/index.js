var track = require("../track");
var Env = require("../environment");
var log = require("../logging").from(__filename);
// var FS = require("q-io/fs");

/* Catch possible hidden error */
process.on('uncaughtException', function (err) {
  log("*uncaughtException*", err, err.stack);
});

var projectChainFactory = require("./chain");

var GithubSessionStore = require("../github-session-store");
var Session = require("../session");
var CheckSession = require("../check-session");

var ContainerManager = require("./container-manager");
var Docker = require("./docker");
var containerIndex = require("./make-container-index")("/srv/container-index.json");
var subdomainDetailsMap = require("./subdomain-details-map");

var SESSION_SECRET = "bdeffd49696a8b84e4456cb0740b3cea7b4f85ce";

var commandOptions = {
    "port": {
        alias: "p",
        describe: "The port to run the app server on",
        default: Env.project.port || Env.port
    },
    "mount-workspaces": {
        describe: "Set to mount the container workspaces on the host",
        default: false
    },
    "help": {
        describe: "Show this help",
    }
};


module.exports = main;
function main(options) {
    var sessions = Session("session", SESSION_SECRET, {domain: Env.getProjectHost()}, new GithubSessionStore());

    var docker  = new Docker({socketPath: "/var/run/docker.sock"});
    if (!Env.production) {
        docker = mountVolume(docker, options["mount-workspaces"], "/home/montage/workspace");
    }

    var projectChain = projectChainFactory({
        sessions: sessions,
        checkSession: CheckSession,
        containerManager: new ContainerManager(docker, containerIndex, subdomainDetailsMap),
        containerIndex: containerIndex
    });
    return projectChain.listen(options.port)
    .then(function (server) {
        log("Listening on", Env.app.href);

        server.node.on("upgrade", projectChain.upgrade);

        // for naught
        if (process.send) {
            process.on("message", function(message) {
                if (message === "shutdown") {
                    log("shutdown message from Naught");
                    // TODO gracefully shutdown the websocket connections
                    server.stop()
                    .catch(function (error) {
                        global.console.error("Error shutting down", error.stack);
                        throw error;
                    })
                    .finally(function () {
                        log("goodbye.");
                        process.exit(0);
                    });
                }
            });

            process.send("online");
        }
    });
}

/**
 * This patches the Docker object to mount Firefly inside the container,
 * similar to how Vagrant mounts the files inside the VM. File changes on disk
 * propogate into the VM, and into the containers. This means that the
 * containers don't need to be recreated every time that the server changes,
 * they just need to be restarted.
 * @param  {Docker} docker
 * @return {Docker}        The patched docker object
 */
function mountVolume(docker, shouldMountWorkspaces, workspacePath) {
    var originalCreateContainer = docker.createContainer;
    docker.createContainer = function (options) {
        // TODO: Reinstate this
        return originalCreateContainer.call(this, options);
        // Create the volume on the container base image
        // options.Volumes = {"/srv/firefly": {}, "/srv/filament": {}};
        // // Map the volume to the server location inside the VM, and mark it
        // // read-only (ro)
        // options.Binds = ["/srv/firefly:/srv/firefly:ro", "/srv/filament:/srv/filament:ro"];
        // if (shouldMountWorkspaces) {
        //     options.Volumes[workspacePath] = {};
        //     var hostPath = FS.join("/srv/workspaces", this.id);
        //     options.Binds.push(hostPath + ":" + workspacePath + ":rw");
        //     var self = this;
        //     return FS.makeTree(hostPath)
        //     .then(function () {
        //         return originalCreateContainer.call(self, options);
        //     });
        // } else {
        //     return originalCreateContainer.call(this, options);
        // }
    };

    var originalContainer = docker.Container;
    docker.Container = function () {
        originalContainer.apply(this, arguments);
    };
    docker.Container.prototype = Object.create(originalContainer.prototype);

    return docker;
}

function checkDiskFree() {
    var df = require("./disk-free");
    var INTERVAL = 15 * /*minutes*/ 60 * 1000;

    // level strings from https://rollbar.com/docs/notifier/rollbar.js/configuration#context_1
    var levels = [
        {percent: 5, level: "debug"}, // sanity check
        {percent: 50, level: "warning"},
        {percent: 75, level: "error"},
        {percent: 90, level: "critical"}
    ];
    // This prevents multiple notifications for the same level. When a level
    // gets exceeded this is incremented to the level index. The next check
    // starts from the level afterwards.
    var lastLevelIndex = -1;

    setInterval(function () {
        df().then(function (percentUsed) {
            var level;
            for (var i = lastLevelIndex + 1; i < levels.length; i++) {
                if (percentUsed > levels[i].percent) {
                    level = levels[i].level;
                    lastLevelIndex = i;
                } else {
                    break;
                }
            }

            if (level) {
                var message = "Disk space at " + percentUsed + "%";
                log(level, message);
                track.message(message, null, null, level);
            }
        }).catch(function (error) {
            log(error);
            track.error(error);
        });
    }, INTERVAL);
}

if (require.main === module) {
    var optimist = require("optimist");
    var argv = optimist
        .usage("Usage: $0 [--port=<port>]")
        .options(commandOptions).argv;

    if (argv.help) {
        optimist.showHelp();
        return;
    }

    // only check disk free when run as a main process
    checkDiskFree();

    main(argv).done();
}
