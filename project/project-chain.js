var log = require("../logging").from(__filename);
var track = require("../track");
var Promise = require("bluebird");
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
var PreviewDetails = require("./preview-details");
var subdomainDetailsMap = require("./subdomain-details-map");

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
            var previewDetails = subdomainDetailsMap.detailsFromUrl(request.headers.host);
            return preview.processAccessRequest(request, previewDetails);
        });
    })
    .use(function (next) {
        return function (request, response) {
            if (preview.isPreview(request)) {
                var previewDetails = subdomainDetailsMap.detailsFromUrl(request.headers.host);
                if (!previewDetails) {
                    return preview.serveAccessForm(request);
                }

                return preview.hasAccess(previewDetails, request.session)
                .then(function (hasAccess) {
                    var details = subdomainDetailsMap.detailsFromUrl(request.url);
                    if (hasAccess) {
                        var projectWorkspacePort = containerManager.getPort(details);
                        if (!projectWorkspacePort) {
                            return preview.serveNoPreviewPage(request);
                        }
                        return proxyContainer(request, projectWorkspacePort, "static")
                        .catch(function (error) {
                            // If there's an error making the request then serve
                            // the no preview page. The container has probably
                            // been shut down due to inactivity
                            return preview.serveNoPreviewPage(request);
                        });
                    } else {
                        containerManager.setup(details)
                        .then(function (projectWorkspacePort) {
                            if (!projectWorkspacePort) {
                                return;
                            }
                            var code = preview.getAccessCode(previewDetails);
                            // Chunk into groups of 4 by adding a space after
                            // every 4th character except if it's at the end of
                            // the string
                            code = code.replace(/(....)(?!$)/g, "$1 ");
                            return HTTP.request({
                                method: "POST",
                                url: "http://127.0.0.1:" + projectWorkspacePort + "/notice",
                                headers: {"content-type": "application/json; charset=utf8"},
                                body: [JSON.stringify("Preview access code: " + code)]
                            });
                        })
                        .catch(function (error) {
                            log("*Error with preview access code*", error.stack);
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

            return Promise.all(workspaceKeys.map(function (details) {
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
            .then(function (projectWorkspacePort) {
                return proxyContainer(request, projectWorkspacePort, "api");
            });
        });
    });

    var proxyAppWebsocket = ProxyWebsocket(containerManager, sessions, "firefly-app");
    var proxyPreviewWebsocket = ProxyWebsocket(containerManager, sessions, "firefly-preview");
    chain.upgrade = function (request, socket, body) {
        new Promise(function (resolve) {
            if (!WebSocket.isWebSocket(request)) {
                resolve();
            }
            var details;
            if (preview.isPreview(request)) {
                resolve(sessions.getSession(request, function (session) {
                    var previewDetails = subdomainDetailsMap.detailsFromUrl(request.headers.host);
                    if (previewDetails) {
                        return preview.hasAccess(previewDetails, session);
                    } else {
                        return false;
                    }
                }).then(function (hasAccess) {
                    if (hasAccess) {
                        log("preview websocket", request.headers.host);
                        details = subdomainDetailsMap.detailsFromUrl(request.headers.host);
                        return proxyPreviewWebsocket(request, socket, body, details);
                    } else {
                        socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
                        socket.destroy();
                    }
                }));
            } else {
                log("filament websocket");
                resolve(sessions.getSession(request, function (session) {
                    details = environment.getDetailsFromAppUrl(request.url);
                    details = new PreviewDetails(session.username, details.owner, details.repo);
                    return proxyAppWebsocket(request, socket, body, details);
                }));
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
