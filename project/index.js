process.on("uncaughtException", function (error) {
    global.console.log("Uncaught exception:", error.stack);
});

// To see the memory usage logged run:
// kill -USR2 <pid>
process.on("SIGUSR2", function() {
    global.console.log(process.memoryUsage());
});

const log = require("logging").from(__filename);

const FS = require("q-io/fs");
const Mop = require("./mop");
const request = require("request");

/* Catch possible hidden error */
process.on('uncaughtException', (err) => log("*uncaughtException*", err, err.stack));

const containerChainFactory = require("./chain");
const SetupProjectWorkspace = require("./setup-project-workspace");

const commandOptions = {
    "config": {
        alias: "c",
        describe: "A JSON string of configuration for the server",
        demand: true
    },
    "directory": {
        alias: "d",
        describe: "The directory to clone and serve projects from",
        default: "/root/workspace"
    },
    "port": {
        alias: "p",
        describe: "The port to run the app server on",
        default: 2441
    },
    "help": {
        describe: "Show this help"
    }
};

module.exports = async (options) => {
    if (!options.config || typeof options.config !== "object") {
        throw new Error("Config must be an object, not " + options.config);
    }
    const config = options.config;
    if (!config.githubAccessToken || !config.githubUser || !config.username || !config.owner || !config.repo || !config.subdomain) {
        throw new Error("Config must contain properties: githubAccessToken, githubUser, username, owner, repo, subdomain, given " + JSON.stringify(Object.keys(config)));
    }

    const fs = options.fs || FS;
    const minitPath = fs.join(__dirname, "..", "node_modules", "minit", "minit");
    Mop.init(fs, options.directory);

    const containerChain = containerChainFactory({
        fs: fs,
        config: config,
        workspacePath: options.directory,
        setupProjectWorkspace: SetupProjectWorkspace(config, options.directory, minitPath),
        request: request 
    });
    const server = await containerChain.listen(options.port);
    log("Listening on", options.port);

    server.node.on("upgrade", containerChain.upgrade);

    // for naught
    if (process.send) {
        process.on("message", async (message) => {
            if (message === "shutdown") {
                log("shutdown message from Naught");
                // TODO gracefully shutdown the websocket connections
                try {
                    await server.stop();
                } catch (error) {
                    global.console.error("Error shutting down", error.stack);
                    throw error;
                } finally {
                    log("goodbye.");
                    process.exit(0);
                }
            }
        });

        process.send("online");
    }
}

if (require.main === module) {
    const optimist = require("optimist");
    const argv = optimist
        .usage("Usage: $0 [--directory=<directory>] [--port=<port>] --config=<JSON string>")
        .options(commandOptions).argv;

    if (argv.help) {
        optimist.showHelp();
        return;
    }

    try {
        argv.config = JSON.parse(argv.config);
    } catch (error) {
        throw new Error(`Could not parse config ${argv.config} : ${error.message}`);
    }

    log("start container server", argv.config.username);
    module.exports(argv).done();
}
