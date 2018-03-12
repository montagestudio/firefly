var log = require("../common/logging").from(__filename);
var track = require("../common/track");
var Q = require("q");
var URL = require("url");
var joey = require("joey");
var APPS = require("q-io/http-apps");
var environment = require("../common/environment");

var LogStackTraces = require("../common/log-stack-traces");
var parseCookies = require("../common/parse-cookies");
var routeProject = require("../common/route-project");

var PreviewManager = require("./preview");

var proxyContainer = require("./proxy-container");
var ProxyWebsocket = require("./proxy-websocket");
var WebSocket = require("faye-websocket");
var PreviewDetails = require("./preview-details");

module.exports = server;
function server(options) {
    options = options || {};

    //jshint -W116
    if (!options.sessions) throw new Error("options.sessions required");
    var sessions = options.sessions;
    if (!options.checkSession) throw new Error("options.checkSession required");
    var checkSession = options.checkSession;
    if (!options.containerManager) throw new Error("options.containerManager required");
    var containerManager = options.containerManager;
    if (!options.containerIndex) throw new Error("options.containerIndex required");
    var containerIndex = options.containerIndex;
    //jshint +W116

    var previewManager = new PreviewManager(containerManager);

    var chain = joey
    .error()
    .cors(environment.getAppUrl(), "*", "*")
    .headers({"Access-Control-Allow-Credentials": true})
    // Put here to avoid printing logs when HAProxy pings the server for
    // a health check
    .route(function () {
        this.OPTIONS("*").content("");
    })
    .use(track.joeyErrors)
    .use(LogStackTraces(log))
    .tap(parseCookies)
    .use(sessions)
    .route(function (_, GET, PUT, POST) {
        // This endpoint recieves a POST request with a session ID as the
        // payload. It then "echos" this back as a set-cookie, so that
        // the project domain now has the session cookie from the app domain
        GET("session")
        .log(log, function (message) { return message; })
        .parseQuery()
        .app(function (request, response) {
            var next = APPS.redirect(request, environment.getAppUrl());
            var referrer = request.headers.referer && URL.parse(request.headers.referer).host;
            if (
                // HACK, FIXME: remove referred check as when people log in to
                // Github the referrer gets unset
                true ||
                referrer === environment.getAppHost()
            ) {
                if (request.query.id) {
                    return sessions.get(request.query.id)
                    .then(function (session) {
                        if (session) {
                            request.session = session;
                            return routeProject.addRouteProjectCookie(request, next);
                        } else {
                            track.message("can't decode session", request, null, "error");
                            return APPS.badRequest(request);
                        }
                    });
                } else {
                    return sessions.destroy(request.session).thenResolve(next);
                }
            } else {
                log("Invalid request to /session from referer", request.headers.referer);
                track.message("bad session toss referer", request, null, "warning");
                return {
                    status: 403,
                    headers: {},
                    body: [""]
                };
            }
        });

        POST("access")
        .log(log, function (message) { return message; })
        .app(function (request) {
            var previewDetails = PreviewDetails.fromPath(request.pathname);
            return previewManager.processAccessRequest(request, previewDetails);
        });
    })
    .use(previewManager.route)
    .log(log, function (message) { return message; })
    .use(checkSession)
    .route(function (any, GET, PUT, POST) {
        GET("api/workspaces").app(function (request) {
            var username = request.session.username;
            var workspaceKeys = containerIndex.forUsername(username).keys();

            return APPS.json(workspaceKeys);
        });

        GET("build/:owner/:repo/...").app(function (request) {
            log("build");
            var session = request.session;
            return session.githubUser.then(function (githubUser) {
                return containerManager.setup(
                    new PreviewDetails(
                        session.username,
                        request.params.owner,
                        request.params.repo
                    ),
                    session.githubAccessToken,
                    githubUser
                );
            })
            .then(function (projectWorkspacePort) {
                return proxyContainer(request, projectWorkspacePort, "build");
            });
        });

        this.DELETE("api/workspaces").app(function (request) {
            var username = request.session.username;
            var workspaceKeys = containerIndex.forUsername(username).keys();

            track.message("delete containers", request, {number: workspaceKeys.length});

            return Q.all(workspaceKeys.map(function (details) {
                // delete
                return containerManager.delete(details)
                .catch(function (error) {
                    // catch error and log
                    track.error(error, request);
                });
            }))
            .then(function () {
                return APPS.json({deleted: true});
            });
        });

        any("api/:owner/:repo/...").app(function (request) {
            var session = request.session;
            return session.githubUser.then(function (githubUser) {
                return containerManager.setup(
                    new PreviewDetails(
                        session.username,
                        request.params.owner,
                        request.params.repo
                    ),
                    session.githubAccessToken,
                    githubUser
                );
            })
            .then(function (projectWorkspaceUrl) {
                return proxyContainer(request, projectWorkspaceUrl, "api");
            });
        });
    });

    var proxyAppWebsocket = ProxyWebsocket(containerManager, sessions, "firefly-app");
    chain.upgrade = function (request, socket, body) {
        Q.try(function () {
            if (!WebSocket.isWebSocket(request)) {
                return;
            }
            var details;
            if (previewManager.isPreview(request)) {
                return previewManager.upgrade(request, socket, body);
            } else {
                log("filament websocket");
                return sessions.getSession(request, function (session) {
                    details = environment.getDetailsFromAppUrl(request.url);
                    details = new PreviewDetails(session.username, details.owner, details.repo);
                    return proxyAppWebsocket(request, socket, body, details);
                });
            }
        })
        .catch(function (error) {
            log("*Error setting up websocket*", error.stack);
            socket.write("HTTP/1.1 500 Internal Server Error\r\n\r\n");
            socket.destroy();
            track.error(error, request);
        });
    };

    return chain;
}
