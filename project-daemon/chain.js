var log = require("./common/logging").from(__filename);
var track = require("./common/track");
var Q = require("q");
var joey = require("joey");
var APPS = require("q-io/http-apps");
var environment = require("./common/environment");

var LogStackTraces = require("./common/log-stack-traces");
var jwt = require("./common/jwt");
var ProjectInfo = require("./common/project-info");

var PreviewManager = require("./preview");

var proxyContainer = require("./proxy-container");
var ProxyWebsocket = require("./proxy-websocket");
var WebSocket = require("faye-websocket");

module.exports = server;
function server(options) {
    options = options || {};

    //jshint -W116
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
    .use(function (next) {
        // Put the githubUser on the request, without redirect 401 if not available
        return jwt(next, next);
    })
    .route(function (_, GET, PUT, POST) {
        POST("access")
        .log(log, function (message) { return message; })
        .app(function (request) {
            var projectInfo = ProjectInfo.fromPath(request.pathname);
            return previewManager.processAccessRequest(request, projectInfo);
        });
    })
    .use(previewManager.route)
    .log(log, function (message) { return message; })
    .use(jwt)
    .route(function (any, GET, PUT, POST) {
        GET("api/workspaces").app(function (request) {
            var username = request.githubUser.login;
            var workspaceKeys = containerIndex.forUsername(username).keys();

            return APPS.json(workspaceKeys);
        });

        GET("build/:owner/:repo/...").app(function (request) {
            log("build");
            return containerManager.setup(
                new ProjectInfo(
                    request.githubUser.login,
                    request.params.owner,
                    request.params.repo
                ),
                request.githubAccessToken,
                request.githubUser
            )
            .then(function (projectWorkspacePort) {
                return proxyContainer(request, projectWorkspacePort, "build");
            });
        });

        this.DELETE("api/workspaces").app(function (request) {
            var username = request.githubUser.login;
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
            return containerManager.setup(
                new ProjectInfo(
                    request.githubUser.login,
                    request.params.owner,
                    request.params.repo
                ),
                request.githubAccessToken,
                request.githubUser
            )
            .then(function (projectWorkspaceUrl) {
                return proxyContainer(request, projectWorkspaceUrl, "api");
            });
        });
    });

    var proxyAppWebsocket = ProxyWebsocket(containerManager, "firefly-app");
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
                var accessTokenMatch = /token=(.*?);/.exec(request.headers.cookie);
                return jwt.verify(accessTokenMatch && accessTokenMatch[1])
                    .then(function (payload) {
                        details = environment.getDetailsFromAppUrl(request.url);
                        details = new ProjectInfo(payload.githubUser.login, details.owner, details.repo);
                        return proxyAppWebsocket(request, socket, body, details);
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
            track.error(error, request);
        });
    };

    return chain;
}
