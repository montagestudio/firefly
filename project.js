var Env = require("./environment");
var log = require("logging").from(__filename);
var FS = require("q-io/fs");

var projectChainFactory = require("./project/project-chain");

var GithubSessionStore = require("./github-session-store");
var Session = require("./session");
var CheckSession = require("./check-session");

var SetupProjectContainer = require("./project/setup-project-container");
var Docker = require("./project/docker");
var containerIndex = require("./project/make-container-index")("/srv/container-index.json");

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
    var sessions = Session("session", SESSION_SECRET, null, new GithubSessionStore());

    var docker  = new Docker({socketPath: "/var/run/docker.sock"});
    if (!Env.production) {
        docker = mountVolume(docker, options["mount-workspaces"], "/home/montage/workspace");
    }

    var projectChain = projectChainFactory({
        sessions: sessions,
        checkSession: CheckSession,
        setupProjectContainer: SetupProjectContainer(docker, containerIndex)
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
        // Create the volume on the container base image
        options.Volumes = {"/srv/firefly": {}, "/srv/filament": {}};
        if (shouldMountWorkspaces) {
            log("Mounting container workspace");
            options.Volumes[workspacePath] = {};
        }
        return originalCreateContainer.call(this, options);
    };

    var originalContainer = docker.Container;
    docker.Container = function () {
        originalContainer.apply(this, arguments);
    };
    docker.Container.prototype = Object.create(originalContainer.prototype);
    docker.Container.prototype.start = function (options) {
        // Map the volume to the server location inside the VM, and mark it
        // read-only (ro)
        options.Binds = ["/srv/firefly:/srv/firefly:ro", "/srv/filament:/srv/filament:ro"];

        if (shouldMountWorkspaces) {
            var hostPath = FS.join("/srv/workspaces", this.id);
            options.Binds.push(hostPath + ":" + workspacePath + ":rw");
            var self = this;
            return FS.makeTree(hostPath)
            .then(function () {
                return originalContainer.prototype.start.call(self, options);
            });
        } else {
            return originalContainer.prototype.start.call(this, options);
        }
    };

    return docker;
}

if (require.main === module) {
    var optimist = require("optimist");
    var argv = optimist
        .usage("Usage: $0 [--client=<directory>] [--directory=<directory>] [--port=<port>]")
        .options(commandOptions).argv;

    if (argv.help) {
        optimist.showHelp();
        return;
    }

    main(argv).done();
}
