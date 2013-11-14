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

module.exports = main;
function main(options) {
    options = options || {};
    options.fs = options.fs || FS;

    options.port = options.port || commandOptions.port.default;

    return options.fs.exists(options.client)
    .then(function (clientExists) {
        if (!clientExists) {
            throw new Error("Client directory '" + options.client + "' does not exist");
        }

        return joey
        .log()
        .error()
        .route(function ($) {
            var index = options.fs.join(options.client, "index.html");
            // Doing this instead of `.file(...)`, because .file does not take
            // a file system to use
            $("").terminate(function () {
                return function (request, response) {
                    return HttpApps.file(request, index, "text/html", options.fs);
                };
            });
        })
        .fileTree(options.client, {fs: options.fs})
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
