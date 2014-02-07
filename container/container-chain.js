var log = require("logging").from(__filename);
var joey = require("joey");

var LogStackTraces = require("../log-stack-traces");

var api = require("./api");

module.exports = server;
function server(options) {
    options = options || {};

    //jshint -W116
    if (!options.setupProjectWorkspace) throw new Error("options.setupProjectWorkspace required");
    var setupProjectWorkspace = options.setupProjectWorkspace;
    if (!options.config) throw new Error("options.config required");
    var config = options.config;
    //jshint +W116

    var chain = joey
    .error()
    // Put here to avoid printing logs when HAProxy pings the server for
    // a health check
    .route(function () {
        this.OPTIONS("").content("");
    })
    .log(log, function (message) { return message; })
    .use(LogStackTraces(log))
    .route(function (route) {
        route("api/...")
        .tap(setupProjectWorkspace)
        .app(api(config).end());
    });

    return chain;
}

