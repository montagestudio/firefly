var log = require("logging").from(__filename);
var track = require("../track");
var joey = require("joey");
var env = require("../environment");
var Q = require("q");

var HttpApps = require("q-io/http-apps");
var serveFile = require("../serve-file");
var parseCookies = require("../parse-cookies");
var GithubAuth = require("../auth/github");
var checkSession = require("../check-session");
var routeProject = require("../route-project");
var LogStackTraces = require("../log-stack-traces");

module.exports = server;
function server(options) {
    options = options || {};

    //jshint -W116
    if (!options.fs) throw new Error("options.fs required");
    var fs = options.fs;
    if (!options.client) throw new Error("options.client required");
    var client = fs.absolute(options.client);
    if (!options.sessions) throw new Error("options.sessions required");
    var sessions = options.sessions;
    //jshint +W116

    var safeOrigin = " http://*." + env.project.hostname + ":* https://*." + env.project.hostname + ":*";

    return joey
    .error()
    // Put here to avoid printing logs when HAProxy pings the server for
    // a health check
    .route(function () {
        this.OPTIONS("").content("");
    })
    .log(log, function (message) { return message; })
    .use(track.joeyErrors)
    .use(LogStackTraces(log))
    .parseQuery()
    .tap(parseCookies)
    .use(sessions)
    .headers({
        "Content-Security-Policy": [
            "default-src 'self'" + safeOrigin,
            "script-src 'self' 'unsafe-eval'" + safeOrigin,
            "connect-src 'self' https://api.github.com ws://" + env.app.hostname + ":* wss://" + env.app.hostname + ":*" + safeOrigin,
            "img-src 'self' data: https://*.githubusercontent.com" + safeOrigin,
            "style-src 'self' 'unsafe-inline'" + safeOrigin,
            "report-uri /csp_report"
            // These are covered by the default-src
            // "font-src 'self'" + safeOrigin,
            // "frame-src 'self'" + safeOrigin,
            // "object-src 'self'" + safeOrigin,
        ].join(";"),
        "X-Frame-Options": "DENY",
        // Disabled for the moment, because I don't want to accidentally lock
        // us in to HTTPS in development, or until we've put HTTPS in
        // production through its paces a bit more.
        // "Strict-Transport-Security": "max-age=2592000" // 30*24*60*60 second = 30 days
    })
    .route(function (route, GET, PUT, POST) {
        // Public routes only

        var serveLogin = serveFile(fs.join(client, "login", "index.html"), "text/html", fs)();
        var serveProjects = serveFile(fs.join(client, "project-list", "index.html"), "text/html", fs)();
        var root = checkSession(serveProjects, serveLogin);
        route("").app(root);

        route("favicon.ico").terminate(serveFile(fs.join(client, "favicon.ico"), "image/x-icon", fs));

        route("auth/...").route(function (route) {
            route("github/...").route(GithubAuth);

            // This passes the sessionId onto the project/preview domain
            // It is also used in /logout to remove the session cookie from the
            // project/preview domain
            route("next").app(function (request) {
                return HttpApps.redirect(request, env.getProjectUrl("session") + "/session?id=" + (request.session.sessionId || ""));
            });
        });

        POST("csp_report").app(function (request) {
            request.body.read()
            .then(function (body) {
                log("*CSP report*", body.toString("utf8"));
            });
            return {status: 200, body: []};
        });
    })
    //////////////////////////////////////////////////////////////////////
    .use(checkSession)
    //////////////////////////////////////////////////////////////////////
    .use(function (next) {
        return function (request) {
            return Q.when(next(request))
            .then(function (response) {
                return routeProject.addRouteProjectCookie(request, response);
            });
        };
    })
    //////////////////////////////////////////////////////////////////////
    .route(function (route) {
        // Private/authenticated routes
        route("logout")
        .tap(function (request) {
            return sessions.destroy(request.session);
        })
        .redirect("/auth/next");

        // TODO Remove this:
        // Redirect the old /projects URL for the moment
        route("projects").redirect(env.getAppUrl(), 301);

        var index = fs.join(client, "firefly-index.html");
        var serveApp = serveFile(index, "text/html", fs);
        route(":owner/:repo").terminate(serveApp);
        route(":owner/:repo/").terminate(serveApp);
    });
}
