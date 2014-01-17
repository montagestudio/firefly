var log = require("logging").from(__filename);
var joey = require("joey");
var env = require("./environment");

var serveFile = require("./serve-file");
var parseCookies = require("./parse-cookies");
var GithubAuth = require("./auth/github");
var checkSession = require("./check-session");
var LogStackTraces = require("./log-stack-traces");

module.exports = server;
function server(options) {
    options = options || {};

    //jshint -W116
    if (!options.fs) throw new Error("options.fs required");
    var fs = options.fs;
    if (!options.client) throw new Error("options.client required");
    var client = options.client;
    if (!options.sessions) throw new Error("options.sessions required");
    var sessions = options.sessions;
    //jshint +W116

    client = fs.absolute(client);

    return joey
    .error()
    // Put here to avoid printing logs when HAProxy pings the server for
    // a health check
    .route(function () {
        this.OPTIONS("").content("");
    })
    .log(log, function (message) { return message; })
    .use(LogStackTraces(log))
    .parseQuery()
    .tap(parseCookies)
    .use(sessions)
    .route(function (route) {
        // Public routes only

        route("").terminate(serveFile(fs.join(client, "login", "index.html"), "text/html", fs));
        route("favicon.ico").terminate(serveFile(fs.join(client, "favicon.ico"), "image/x-icon", fs));

        route("auth/...").route(function (route) {
            route("github/...").route(GithubAuth);
        });
    })
    //////////////////////////////////////////////////////////////////////
    .use(checkSession)
    //////////////////////////////////////////////////////////////////////
    .route(function (route) {
        // Private/authenticated routes
        route("logout")
        .tap(function (request) {
            return sessions.destroy(request.session);
        })
        .redirect(env.getAppUrl());

        route("projects").terminate(serveFile(fs.join(client, "project-list", "index.html"), "text/html", fs));
    });
}
