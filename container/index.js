process.on("uncaughtException", function (error) {
    global.console.log("Uncaught exception:", error.stack);
});

// If the workspace dir exists correct the permisions before dropping uid and
// gid. This is only used when in development mode.
// Magic number 1000 is the `montage` user's UID, because I couldn't find a
// way to easily look up a user's UID from a username in Node (even though
// process.setuid does it below!)
var fs = require("fs");
if (fs.existsSync("/home/montage/workspace")) {
    fs.chownSync("/home/montage/workspace", 1000, 1000);
}
// If root drop to unprivileged user
if (process.getgid() === 0) {
    process.setgid("montage");
    process.setuid("montage");
}

// To see the memory usage logged run:
// kill -USR2 <pid>
process.on("SIGUSR2", function() {
    global.console.log(process.memoryUsage());
});

var log = require("../logging").from(__filename);

var track = require("../track");
var FS = require("q-io/fs");
var Mop = require("./mop");

var containerChainFactory = require("./container-chain");
var SetupProjectWorkspace = require("./setup-project-workspace");

var commandOptions = {
    "config": {
        alias: "c",
        describe: "A JSON string of configuration for the server",
        demand: true
    },
    "filament": {
        alias: "f",
        describe: "A directory containing filament",
        default: "/srv/filament"
    },
    "directory": {
        alias: "d",
        describe: "The directory to clone and serve projects from",
        default: "/home/montage/workspace"
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
    if (!config.githubAccessToken || !config.githubUser || !config.username || !config.owner || !config.repo || !config.subdomain) {
        throw new Error("Config must contain properties: githubAccessToken, githubUser, username, owner, repo, subdomain, given " + JSON.stringify(Object.keys(config)));
    }

    var fs = options.fs || FS;
    var minitPath = fs.join(__dirname, "..", "node_modules", "minit", "minit");
    Mop.init(fs, options.directory);

    var containerChain = containerChainFactory({
        fs: fs,
        config: config,
        workspacePath: options.directory,
        client: options.filament,
        clientServices: options.clientServices,
        setupProjectWorkspace: SetupProjectWorkspace(config, options.directory, minitPath)
    });
    return containerChain.listen(options.port)
    .then(function (server) {
        log("Listening on", options.port);

        server.node.on("upgrade", containerChain.upgrade);

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

    // TODO this should be moved to main, and generated by listing the client
    // backend_plugins directory
    argv.clientServices = {
        // "filament-services": "backend_plugins/filament-backend"
    };

    track.messageForUsername("start container server", argv.config.username);
    main(argv).done();
}
