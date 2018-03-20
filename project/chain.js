var log = require("./common/logging").from(__filename);
var track = require("./common/track");
var Q = require("q");
var joey = require("joey");

var HttpApps = require("q-io/http-apps/fs");
var StatusApps = require("q-io/http-apps/status");

var LogStackTraces = require("./common/log-stack-traces");

var api = require("./api");
var serveArchivedBuild = require("./mop").serveArchivedBuild;
var Preview = require("./preview/preview-server").Preview;
var WebSocket = require("faye-websocket");
var websocket = require("./websocket");
var Frontend = require("./frontend");

module.exports = server;
function server(options) {
    options = options || {};

    //jshint -W116
    if (!options.setupProjectWorkspace) throw new Error("options.setupProjectWorkspace required");
    var setupProjectWorkspace = options.setupProjectWorkspace;
    if (!options.config) throw new Error("options.config required");
    var config = options.config;
    if (!options.workspacePath) throw new Error("options.workspacePath required");
    var workspacePath = options.workspacePath;
    if (!options.fs) throw new Error("options.fs required");
    var fs = options.fs;
    //jshint +W116

    var preview = Preview(config);

    var chain = joey
    .error()
    // Put here to avoid printing logs when HAProxy pings the server for
    // a health check
    .route(function () {
        this.OPTIONS("").content("");
    })
    .use(track.joeyErrors)
    .use(LogStackTraces(log))
    .tap(setupProjectWorkspace)
    .route(function (route, _, __, POST) {
        var serveProject = preview(function (request) {
            // Aboslute the path so that ".." components are removed, then
            // strip leading slash on pathInfo so that the `join` works
            var path = fs.absolute(decodeURI(request.pathInfo)).replace(/^\//, "");
            path = fs.join(workspacePath, path);

            return fs.isFile(path).then(function(isFile) {
                if (isFile) {
                    return HttpApps.file(request, path, null, fs);
                } else {
                    return StatusApps.notFound(request);
                }
            });
        });

        route("api/...")
        .log(log, function (message) { return message; })
        .app(api(config).end());

        route("static/...")
        .app(serveProject);

        route("build/archive")
        .app(serveArchivedBuild);

        POST("notice")
        .app(function (request) {
            return request.body.read()
            .then(function (body) {
                var message = JSON.parse(body.toString());
                Frontend.showNotification(message)
                .catch(function (error) {
                    log("*Error notifying", error.stack);
                    track.error(error, request);
                });
                return {status: 200, body: []};
            });
        });
    });

    var services = {};
    services["file-service"] = require("./services/file-service");
    services["extension-service"] = require("./services/extension-service");
    services["env-service"] = require("./services/env-service");
    services["preview-service"] = require("./services/preview-service").service;
    services["package-manager-service"] = require("./services/package-manager-service");
    services["repository-service"] = require("./services/repository-service");
    services["build-service"] = require("./services/build-service");
    services["asset-converter-service"] = require("./services/asset-converter-service");

    var websocketServer = websocket(config, workspacePath, services);

    chain.upgrade = function (request, socket, head) {
        Q.try(function () {
            if (!WebSocket.isWebSocket(request)) {
                return;
            }

            if (request.headers['sec-websocket-protocol'] === "firefly-preview") {
                return preview.wsServer(request, socket, head);
            } else {
                return websocketServer(request, socket, head);
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

