var log = require("./common/logging").from(__filename);
var track = require("./common/track");
var Q = require("q");
var joey = require("joey");
var APPS = require("q-io/http-apps");
var environment = require("./common/environment");

var LogStackTraces = require("./common/log-stack-traces");
var ProjectInfo = require("./project-info");

var PreviewManager = require("./preview");

var proxyContainer = require("./proxy-container");
var ProxyWebsocket = require("./proxy-websocket");
var WebSocket = require("faye-websocket");

var requestHostStartsWith = function (prefix) {
    return function (req) {
        log("request", req.headers.host, req.pathInfo);
        return req.headers.host.indexOf(prefix) === 0;
    };
};

var getJwtProfile = function (request, authHeader) {
    var options = {
        headers: {
            "Authentication": authHeader
        }
    };
    return request.get("http://jwt/profile", options)
        .then(function (response) {
            return {
                profile: response.data.profile,
                token: response.data.token
            };
        });
};

module.exports = server;
function server(options) {
    options = options || {};

    //jshint -W116
    if (!options.containerManager) throw new Error("options.containerManager required");
    var containerManager = options.containerManager;
    if (!options.request) throw new Error("options.request required");
    var request = options.request;
    //jshint +W116

    var previewManager = new PreviewManager(containerManager);

    var chain = joey
    .error()
    .cors(environment.getAppUrl(), "*", "x-access-token")
    .headers({"Access-Control-Allow-Credentials": true})
    // Put here to avoid printing logs when HAProxy pings the server for
    // a health check
    .route(function () {
        this.OPTIONS("*").content("");
    })
    .use(track.joeyErrors)
    .use(LogStackTraces(log))
    .use(function (next) {
        return function (req) {
            return getJwtProfile(request, "Bearer " + req.headers["x-access-token"])
                .then(function (profile) {
                    Object.assign(req, profile);
                }, Function.noop)
                .then(function () {
                    return next(req);
                });
        };
    })
    .route(function (_, GET, PUT, POST) {
        POST("access", requestHostStartsWith("project"))
        .log(log, function (message) { return message; })
        .app(function (req) {
            var projectInfo = ProjectInfo.fromPath(req.pathname);
            return previewManager.processAccessRequest(req, projectInfo);
        });
    })
    .use(previewManager.route)
    .log(log, function (message) { return message; })
    .use(function (next) {
        return function (req) {
            if (!req.profile) {
                return APPS.responseForStatus(req, 401);
            } else {
                return next(req);
            }
        };
    })
    .route(function (any, GET, PUT, POST) {
        GET("workspaces", requestHostStartsWith("api")).app(function (req) {
            return containerManager.containersForUser(req.profile.username)
                .then(function (containers) {
                    return APPS.json(containers.map(function (container) {
                        return {
                            id: container.id
                        };
                    }));
                });
        });

        this.DELETE("workspaces", requestHostStartsWith("api")).app(function (req) {
            track.message("delete stack", req);
            return containerManager.deleteUserContainers(req.profile.username)
                .then(function () {
                    return APPS.json({deleted: true});
                });
        });

        any(":owner/:repo/...", requestHostStartsWith("api")).app(function (req) {
            var projectInfo = new ProjectInfo(
                req.profile.username,
                req.params.owner,
                req.params.repo
            );
            return containerManager.setup(projectInfo, req.token, req.profile)
                .then(function (host) {
                    return proxyContainer(req, host, "api");
                });
        });

        GET(":owner/:repo/...", requestHostStartsWith("build")).app(function (req) {
            log("build");
            var projectInfo = new ProjectInfo(
                req.profile.username,
                req.params.owner,
                req.params.repo
            );
            return containerManager.setup(projectInfo, req.token, req.profile)
                .then(function (host) {
                    return proxyContainer(req, host, "build");
                });
        });
    });

    var proxyAppWebsocket = ProxyWebsocket(containerManager, "firefly-app");
    chain.upgrade = function (req, socket, body) {
        Q.try(function () {
            if (!WebSocket.isWebSocket(req)) {
                return;
            }
            var details;
            if (previewManager.isPreview(req)) {
                return previewManager.upgrade(req, socket, body);
            } else {
                log("filament websocket");
                var accessTokenMatch = /token=(.*?)(;|$)/.exec(req.headers.cookie);
                return getJwtProfile(request, "Bearer " + (accessTokenMatch && accessTokenMatch[1]))
                    .then(function (profile) {
                        details = environment.getDetailsFromAppUrl(req.url);
                        details = new ProjectInfo(profile.profile.username, details.owner, details.repo);
                        return proxyAppWebsocket(req, socket, body, details);
                    }, function (error) {
                        socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
                        socket.destroy();
                    });
            }
        })
        .catch(function (error) {
            log("*Error setting up websocket*", error.stack);
            socket.write("HTTP/1.1 500 Internal Server Error\r\n\r\n");
            socket.destroy();
            track.error(error, req);
        });
    };

    return chain;
}
