var joey = require("joey");
var FS = require("q-io/fs");
var HttpApps = require("q-io/http-apps/fs");

var commandOptions = {
    "client": {
        alias: "c",
        describe: "A directory containing filament"
    },
    "port": {
        alias: "p",
        describe: "The port to run the server on",
        default: 8080
    }
};

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

    return fs.exists(options.client)
    .then(function (clientExists) {
        if (!clientExists) {
            throw new Error("Client directory '" + options.client + "' does not exist");
        }

        // Need to do this because .file does not take an `fs` argument
        var index = fs.join(options.client, "index.html");
        var serveApp = serveFile(index, "text/html", fs);

        return joey
        .log()
        .error(true) // puts stack traces on error pages. TODO disable in production
        .route(function ($) {
            $("app/adaptor/client/...").fileTree(fs.join(__dirname, "inject", "adaptor", "client"));

            $("app").terminate(serveApp);
            $("app/...").fileTree(options.client, {fs: fs});

            $("welcome").terminate(serveFile(fs.join(options.client, "welcome", "index.html"), "text/html", fs));

            // Must be last, as this is the most generic
            $(":user/:repo/...").terminate(serveApp);
        })
        .listen(options.port);
    })
    .then(function (server) {
        console.log("Listening on http://127.0.0.1:8080");
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
