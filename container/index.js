// If root drop to unprivileged user
if (process.getgid() === 0) {
    process.setgid("montage");
    process.setuid("montage");
}

var log = require("logging").from(__filename);

var containerChainFactory = require("./container-chain");

var SetupProjectWorkspace = require("./setup-project-workspace");

var commandOptions = {
    "config": {
        alias: "c",
        describe: "A JSON string of configuration for the server",
        demand: true
    },
    "directory": {
        alias: "d",
        describe: "The directory to clone and serve projects from",
        default: "/workspace"
    },
    "port": {
        alias: "p",
        describe: "The port to run the app server on",
        default: 2441
    },
    "help": {
        describe: "Show this help",
    }
};

module.exports = main;
function main(options) {
    if (!options.config || typeof options.config !== "object") {
        throw new Error("Config must be an object, not " + options.config);
    }
    var config = options.config;
    if (!config.githubAccessToken || !config.githubUser || !config.owner || !config.repo) {
        throw new Error("Config must contain properties: githubAccessToken, githubUser, owner, repo, given " + JSON.stringify(config));
    }

    var containerChain = containerChainFactory({
        config: config,
        setupProjectWorkspace: SetupProjectWorkspace(config, options.directory, null)
    });
    return containerChain.listen(options.port)
    .then(function (server) {
        log("Listening on", options.port);

        // server.node.on("upgrade", containerChain.upgrade);

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

if (require.main === module) {
    var optimist = require("optimist");
    var argv = optimist
        .usage("Usage: $0 [--directory=<directory>] [--port=<port>] --config=<JSON string>")
        .options(commandOptions).argv;

    if (argv.help) {
        optimist.showHelp();
        return;
    }

    try {
        argv.config = JSON.parse(argv.config);
    } catch (error) {
        throw new Error("Could not parse config " + argv.config + ": " + error.message);
    }

    main(argv).done();
}
