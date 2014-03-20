var log = require("logging").from(__filename);
var track = require("../track");
var Q = require("q");
var URL = require("url");
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
    if (!options.containerIndex) throw new Error("options.containerIndex required");
    var containerIndex = options.containerIndex;
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
    .use(track.joeyErrors)
    .use(LogStackTraces(log))
    .tap(parseCookies)
    .use(sessions)
    .route(function (_, GET, PUT, POST) {
        // This endpoint recieves a POST request with a session ID as the
        // payload. It then "echos" this back as a set-cookie, so that
        // the project domain now has the session cookie from the app domain
        GET("session")
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
                            // Chunk into groups of 4 by adding a space after
                            // every 4th character except if it's at the end of
                            // the string
                            code = code.replace(/(....)(?!$)/g, "$1 ");
                            return HTTP.request({
                                method: "POST",
                                url: "http://127.0.0.1:" + projectWorkspacePort + "/notice",
                                headers: {"content-type": "application/json; charset=utf8"},
                                body: [JSON.stringify("Access code: " + code)]
                            });
                        })
                        .catch(function (error) {
                            log("*Error with access code*", error.stack);
                            track.error(error, request);
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
    .route(function (any, GET, PUT, POST) {
        GET("api/workspaces").app(function (request) {
            var username = request.session.username;
            var workspaceKeys = containerIndex.forUsername(username).keys();

            return APPS.json(workspaceKeys);
        });

        this.DELETE("api/workspaces").app(function (request) {
            var username = request.session.username;
            var workspaceKeys = containerIndex.forUsername(username).keys();

            track.message("delete containers", request, {number: workspaceKeys.length});

            return Q.all(workspaceKeys.map(function (value) {
                // delete
                return setupProjectContainer.delete(value.user, value.owner, value.repo)
                .catch(function (error) {
                    // catch error and log
                    track.error(error, request);
                })
                .then(function () {
                    // remove from containerIndex
                    containerIndex.delete(value);
                });
            }))
            .then(function () {
                return APPS.json({deleted: true});
            });
        });

        any("api/:owner/:repo/...").app(function (request) {
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
            track.error(error, request);
        });
    };

    return chain;
}
