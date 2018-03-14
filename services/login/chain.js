var log = require("../common/logging").from(__filename);
var track = require("../common/track");
var joey = require("joey");
var env = require("../common/environment");
var Q = require("q");

var HttpApps = require("q-io/http-apps");
var serveFile = require("./serve-file");
var parseCookies = require("../common/parse-cookies");
var GithubAuth = require("./github");
var checkSession = require("../common/check-session");
var routeProject = require("../common/route-project");
var LogStackTraces = require("../common/log-stack-traces");

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
    .route(function (route) {
        // Public routes only

        var serveLogin = serveFile(fs.join(client, "login", "index.html"), "text/html", fs)();
        var serveProjects = serveFile(fs.join(client, "project-list", "index.html"), "text/html", fs)();
        var root = checkSession(function (request) {
            track.message("load project page", request);
            return serveProjects(request);
        }, serveLogin);
        route("").app(root);

        route("favicon.ico").terminate(serveFile(fs.join(client, "favicon.ico"), "image/x-icon", fs));

        route("auth/...").route(function (route) {
            route("github/...").route(GithubAuth);

            // This passes the sessionId onto the project/preview domain
            // It is also used in /logout to remove the session cookie from the
            // project/preview domain
            route("next").app(function (request) {
                return HttpApps.redirect(request, env.getProjectSubdomain('session') + "session?id=" + (request.session.sessionId || ""));
            });
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

        // We don't have anything to show directly on the user page at the
        // moment, so just redirect them to the root.
        // At the time of writing, if we don't redirect then the app tries to
        // load a project with an empty name "", which causes all kinds of
        // errors.
        route(":owner").redirect("/");
        route(":owner/").redirect("/");

        var index = fs.join(client, "firefly-index.html");
        var serveApp = serveFile(index, "text/html", fs);
        route(":owner/:repo").terminate(serveApp);
        route(":owner/:repo/").terminate(serveApp);
    });
}
