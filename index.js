var Env = require("./environment");
var log = require("logging").from(__filename);
var FS = require("q-io/fs");

var multiplex = require("./multiplex");
var appChain = require("./app-chain");
var projectChain = require("./project-chain");

var Session = require("./session");

var SESSION_SECRET = "bdeffd49696a8b84e4456cb0740b3cea7b4f85ce";

var commandOptions = {
    "client": {
        alias: "c",
        describe: "A directory containing filament"
    },
    "app-port": {
        alias: "p",
        describe: "The port to run the app server on",
        default: Env.app.port
    },
    "project-port": {
        alias: "P",
        describe: "The port to run the project server on",
        default: Env.project.port
    },
    "project-dir": {
        alias: "d",
        describe: "The directory to clone and serve projects from",
        default: "../clone"
    }
};

module.exports = main;
function main(options) {
    var session = Session("session", SESSION_SECRET);

    var fs = options.fs || FS;

    // TODO: multiplex based on request.headers.host, instead of starting
    // two servers on different ports
    return multiplex(
        options,
        appChain,
        {
            fs: fs,
            client: options.client,
            session: session,
            clientServices: options.clientServices
        },
        projectChain,
        {
            fs: fs,
            session: session,
            directory: fs.join(process.cwd(), options["project-dir"])
        })
        .spread(function (app, project) {
            app.server.node.on("upgrade", function (request, socket, head) {
                app.chain.upgrade(request, socket, head);
            });
            log("Listening on http://"+Env.app.host+":" + options["app-port"]);
        });
}

if (require.main === module) {
    var argv = require("optimist")
        .usage("Usage: $0 --client=<directory> [--port=<port>]")
        .demand(["client"])
        .options(commandOptions).argv;

    // TODO this should be moved to main, and generated by listing the client
    // backend_plugins directory
    argv.clientServices = {
        "filament-services": "backend_plugins/filament-backend"
    };

    main(argv).done();
}
