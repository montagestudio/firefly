var joey = require("joey");
var fs = require("q-io/fs");

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

var argv = require("optimist")
    .usage("Usage: $0 --client=<directory> [--port=<port>]")
    .demand(["client"])
    .options(commandOptions).argv;

module.exports = main;
function main(options) {
    options = options || {};
    options.fs = options.fs || fs;

    options.port = options.port || commandOptions.port.default;

    return fs.exists(options.client)
    .then(function (clientExists) {
        if (!clientExists) {
            throw new Error("Client directory '" + options.client + "' does not exist");
        }

        return joey
            .log()
            .error()
            .fileTree(options.client)
            .listen(options.port);
    })
    .then(function () {
        console.log("Listening on http://127.0.0.1:8080");

    });
}

if (require.main === module) {
    main(argv).done();
}
