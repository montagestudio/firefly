var log = require("./common/logging").from(__filename);
var track = require("./common/track");
var Q = require("q");
var joey = require("joey");
var APPS = require("q-io/http-apps");
var environment = require("./common/environment");

var LogStackTraces = require("./common/log-stack-traces");
var jwt = require("./common/jwt");
var ProjectInfo = require("./project-info");

var PreviewManager = require("./preview");

var proxyContainer = require("./proxy-container");
var ProxyWebsocket = require("./proxy-websocket");
var WebSocket = require("faye-websocket");

var requestHostStartsWith = function (prefix) {
    return function (request) {
        log("request", request.headers.host, request.pathInfo);
        return request.headers.host.indexOf(prefix) === 0;
    };
};

module.exports = server;
function server(options) {
    options = options || {};

    //jshint -W116
    if (!options.userStackManager) throw new Error("options.userStackManager required");
    var userStackManager = options.userStackManager;
    //jshint +W116

    var previewManager = new PreviewManager(userStackManager);

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
        POST("access", requestHostStartsWith("project"))
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
        GET("workspaces", requestHostStartsWith("api")).app(function (request) {
            return userStackManager.stacksForUser(request.githubUser)
                .then(function (stacks) {
                    return APPS.json(stacks.map(function (stack) {
                        return stack.id;
                    }));
                });
        });

        this.DELETE("workspaces", requestHostStartsWith("api")).app(function (request) {
            track.message("delete stack", request);
            return userStackManager.removeUserStacks(request.githubUser)
                .then(function () {
                    return APPS.json({deleted: true});
                });
        });

        any(":owner/:repo/...", requestHostStartsWith("api")).app(function (request) {
            var projectInfo = new ProjectInfo(
                request.githubUser.login,
                request.params.owner,
                request.params.repo
            );
            return userStackManager.setup(projectInfo, request.githubAccessToken, request.githubUser)
                .then(function () {
                    return proxyContainer(request, userStackManager.projectUrl(projectInfo), "api");
                });
        });

        GET(":owner/:repo/...", requestHostStartsWith("build")).app(function (request) {
            log("build");
            var projectInfo = new ProjectInfo(
                request.githubUser.login,
                request.params.owner,
                request.params.repo
            );
            return userStackManager.setup(projectInfo, request.githubAccessToken, request.githubUser)
                .then(function () {
                    return proxyContainer(request, userStackManager.projectUrl(projectInfo), "build");
                });
        });
    });

    var proxyAppWebsocket = ProxyWebsocket(userStackManager, "firefly-app");
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
                var accessTokenMatch = /token=(.*?)(;|$)/.exec(request.headers.cookie);
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
