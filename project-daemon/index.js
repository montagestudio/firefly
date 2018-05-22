var log = require("logging").from(__filename);

/* Catch possible hidden error */
process.on('uncaughtException', function (err) {
  log("*uncaughtException*", err, err.stack);
});

var projectChainFactory = require("./chain");

var ContainerManager = require("./container-manager");
var axios = require("axios");

require("./polyfill-dockerode");
var Dockerode = require("dockerode");

var commandOptions = {
    "port": {
        alias: "p",
        describe: "The port to run the app server on",
        default: process.env.FIREFLY_PORT
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
    log("env", process.env.NODE_ENV);
    log("port", process.env.FIREFLY_PORT);
    log("app", process.env.FIREFLY_APP_URL);
    log("project", process.env.FIREFLY_PROJECT_URL);

    var docker  = new Dockerode({socketPath: "/var/run/docker.sock"});

    var projectChain = projectChainFactory({
        containerManager: new ContainerManager(docker),
        request: axios,
    });
    return projectChain.listen(options.port)
    .then(function (server) {
        log("Listening on", process.env.FIREFLY_APP_URL);

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
            }
        }).catch(function (error) {
            console.log(error);
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
