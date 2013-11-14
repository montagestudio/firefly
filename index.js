var joey = require("joey");
var fs = require("q-io/fs");

var argv = require("optimist")
    .usage("Usage: $0 --client=<directory> [--port=<port>]")
    .demand(["client"])
    .options({
        "client": {
            alias: "c",
            describe: "A directory containing filament"
        },
        "port": {
            alias: "p",
            describe: "The port to run the server on",
            default: 8080
        }
    }).argv;

fs.exists(argv.client)
.then(function (clientExists) {
    if (!clientExists) {
        throw new Error("Client directory '" + argv.client + "' does not exist");
    }

    return joey
        .log()
        .error()
        .fileTree(argv.client)
        .listen(argv.port);
})
.then(function () {
    console.log("Listening on http://127.0.0.1:8080");

})
.done();
