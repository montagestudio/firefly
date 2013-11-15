var Q = require("q");
var joey = require("joey");
var FS = require("q-io/fs");
var HttpApps = require("q-io/http-apps/fs");
var HttpContent = require("q-io/http-apps/content");

var SocketServer = require("websocket.io");
var Connection = require("q-connection");

var Session = require("./session");
var parseCookies = require("./parse-cookies");
var GithubAuth = require("./auth/github");

var SESSION_SECRET = "bdeffd49696a8b84e4456cb0740b3cea7b4f85ce";

var commandOptions = {
    "client": {
        alias: "c",
        describe: "A directory containing filament"
    },
    "port": {
        alias: "p",
        describe: "The port to run the server on",
        default: 2440
    }
};

// Need to do this because .file does not take an `fs` argument
function serveFile(path, contentType, fs) {
    return function () {
        return function (request, response) {
            return HttpApps.file(request, path, contentType, fs);
        };
    };
}

module.exports = main;
function main(options) {
    options = options || {};
    options.fs = options.fs || FS;
    options.port = options.port || commandOptions.port.default;

    var fs = options.fs;

    var filamentServices = require(fs.join(options.client, "backend_plugins", "filament-backend"));
    var fileServices = require(fs.join(__dirname, "services", "file-services"));

    return fs.exists(options.client)
    .then(function (clientExists) {
        if (!clientExists) {
            throw new Error("Client directory '" + options.client + "' does not exist");
        }

        var index = fs.join(options.client, "index.html");
        var serveApp = serveFile(index, "text/html", fs);

        return joey
        .log()
        .error(true) // puts stack traces on error pages. TODO disable in production
        .parseQuery()
        .tap(parseCookies)
        .use(Session("session", SESSION_SECRET))
        .route(function (route) {
            route("").terminate(serveFile(fs.join(options.client, "login", "index.html"), "text/html", fs));

            route("app/adaptor/client/...").fileTree(fs.join(__dirname, "inject", "adaptor", "client"));

            route("app").terminate(serveApp);
            route("app/...").fileTree(options.client, {fs: fs});

            route("auth/...").route(function (route) {
                route("github/...").route(GithubAuth);
            });

            route("projects").terminate(serveFile(fs.join(options.client, "project-list", "index.html"), "text/html", fs));

            // FIXME: remove this
            route("clone/...").fileTree(fs.join(__dirname, "..", "clone"));

            // Must be last, as this is the most generic
            route(":user/:repo/...").terminate(serveApp);
        })
        .listen(options.port);
    })
    .then(function (server) {
        var socketServer = SocketServer.attach(server.node);
        socketServer.on("connection", function (connection) {
            console.log("websocket connection");
            Connection(connection, {
                "filament-services": Q.master(filamentServices),
                "file-services": Q.master(fileServices)
            });

            connection.on("close", function(conn) {
                console.warn("websocket connection closed");
            });

            connection.on("error", function(err) {
                if (err.code !== 'ECONNRESET' && err.code !== 'EPIPE') {
                    console.log("#connection error:", err);
                }
            });
        });

        console.log("Listening on http://127.0.0.1:" + options.port);
        return server;
    });
}

if (require.main === module) {
    var argv = require("optimist")
        .usage("Usage: $0 --client=<directory> [--port=<port>]")
        .demand(["client"])
        .options(commandOptions).argv;

    main(argv).done();
}
