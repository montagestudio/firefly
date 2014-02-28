var log = require("logging").from(__filename);
var Q = require("q");
var joey = require("joey");
var HTTP = require("q-io/http");
var APPS = require("q-io/http-apps");
var environment = require("../environment");

var LogStackTraces = require("../log-stack-traces");
var parseCookies = require("../parse-cookies");
var routeProject = require("../route-project");

var preview = require("./preview");

var proxyContainer = require("./proxy-container");
var ProxyWebsocket = require("./proxy-websocket");
var WebSocket = require("faye-websocket");

module.exports = server;
function server(options) {
    options = options || {};

    //jshint -W116
    if (!options.sessions) throw new Error("options.sessions required");
    var sessions = options.sessions;
    if (!options.checkSession) throw new Error("options.checkSession required");
    var checkSession = options.checkSession;
    if (!options.setupProjectContainer) throw new Error("options.setupProjectContainer required");
    var setupProjectContainer = options.setupProjectContainer;
    //jshint +W116

    var chain = joey
    .error()
    .cors(environment.getAppUrl(), "*", "*")
    .headers({"Access-Control-Allow-Credentials": true})
    // Put here to avoid printing logs when HAProxy pings the server for
    // a health check
    .route(function () {
        this.OPTIONS("*").content("");
    })
    .log(log, function (message) { return message; })
    .use(LogStackTraces(log))
    .tap(parseCookies)
    .use(sessions)
    .route(function (_, __, ___, POST) {
        // This endpoint recieves a POST request with a session ID as the
        // payload. It then "echos" this back as a set-cookie, so that
        // the project domain now has the session cookie from the app domain
        POST("session").app(function (request, response) {
            if (request.headers.origin === environment.getAppUrl()) {
                return request.body.read()
                .then(function (body) {
                    var data = JSON.parse(body.toString("utf8"));
                    return sessions.get(data.sessionId)
                    .then(function(session) {
                        if (session) {
                            request.session = session;
                            return routeProject.addRouteProjectCookie(request, APPS.ok());
                        } else {
                            return APPS.badRequest(request);
                        }
                    });
                });
            } else {
                log("Invalid request to /session from origin", request.headers.origin);
                return {
                    status: 403,
                    headers: {},
                    body: ["Bad origin"]
                };
            }
        });

        POST("access").app(preview.processAccessRequest);
    })
    .use(function (next) {
        return function (request, response) {
            if (preview.isPreview(request)) {
                return preview.hasAccess(request.headers.host, request.session)
                .then(function (hasAccess) {
                    var details = environment.getDetailsfromProjectUrl(request.url);
                    if (hasAccess) {
                        return setupProjectContainer(
                            details.owner, // FIXME docker
                            details.owner,
                            details.repo
                        ).then(function (projectWorkspacePort) {
                            if (!projectWorkspacePort) {
                                return preview.serveNoPreviewPage(request);
                            }
                            return proxyContainer(request, projectWorkspacePort, "static");
                        });
                    } else {
                        setupProjectContainer(
                            details.owner, // FIXME docker
                            details.owner,
                            details.repo
                        )
                        .then(function (projectWorkspacePort) {
                            if (!projectWorkspacePort) {
                                return;
                            }
                            var code = preview.getAccessCode(request.headers.host);
                            return HTTP.request({
                                method: "POST",
                                url: "http://127.0.0.1:" + projectWorkspacePort + "/notice",
                                headers: {"content-type": "application/json; charset=utf8"},
                                body: [JSON.stringify("Access code: " + code)]
                            });
                        })
                        .catch(function (error) {
                            log("*Error with access code", error.stack);
                        });

                        // Serve the access form regardless, so that people
                        // can't work out if a project exists or not.
                        return preview.serveAccessForm(request);
                    }
                });
            } else {
                // route /:user/:app/:action
                return next(request, response);
            }
        };
    })
    .use(checkSession)
    .route(function (route) {
        route("api/:owner/:repo/...").app(function (request) {
            var session = request.session;
            return session.githubUser.then(function (githubUser) {
                return setupProjectContainer(
                    session.username,
                    request.params.owner,
                    request.params.repo,
                    session.githubAccessToken,
                    githubUser
                );
            })
            .then(function (projectWorkspacePort) {
                return proxyContainer(request, projectWorkspacePort, "api");
            });
        });
    });

    var proxyAppWebsocket = ProxyWebsocket(setupProjectContainer, sessions, "firefly-app");
    var proxyPreviewWebsocket = ProxyWebsocket(setupProjectContainer, sessions, "firefly-preview");
    chain.upgrade = function (request, socket, body) {
        Q.try(function () {
            if (!WebSocket.isWebSocket(request)) {
                return;
            }
            var details;
            if (preview.isPreview(request)) {
                return sessions.getSession(request, function (session) {
                    return preview.hasAccess(request.headers.host, session);
                }).then(function (hasAccess) {
                    if (hasAccess) {
                        log("preview websocket", request.headers.host);
                        details = environment.getDetailsfromProjectUrl(request.headers.host);
                        return proxyPreviewWebsocket(request, socket, body, details);
                    } else {
                        socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
                        socket.destroy();
                    }
                });
            } else {
                log("filament websocket");
                details = environment.getDetailsFromAppUrl(request.url);
                return proxyAppWebsocket(request, socket, body, details);
            }
        })
        .catch(function (error) {
            log("*Error setting up websocket*", error.stack);
            socket.write("HTTP/1.1 500 Internal Server Error\r\n\r\n");
            socket.destroy();
        });
    };

    return chain;
}
