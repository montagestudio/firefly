var Env = require("./common/environment");
var log = require("./common/logging").from(__filename);

/* Catch possible hidden error */
process.on('uncaughtException', function (err) {
  log("*uncaughtException*", err, err.stack);
});

var loginChainFactory = require("./chain");

var commandOptions = {
    "port": {
        alias: "p",
        describe: "The port to run the server on",
        default: Env.app.port || Env.port
    },
    "help": {
        describe: "Show this help",
    }
};

module.exports = main;
function main(options) {
    var loginChain = loginChainFactory({ });

    return loginChain.listen(options.port)
    .then(function (server) {
        log("Listening on", Env.app.href);

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
        .usage("Usage: $0 [--client=<directory>] [--port=<port>]")
        .options(commandOptions).argv;

    if (argv.help) {
        optimist.showHelp();
        return;
    }

    main(argv).done();
}
