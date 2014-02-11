var log = require("logging").from(__filename);
var joey = require("joey");

var HttpApps = require("q-io/http-apps/fs");
var StatusApps = require("q-io/http-apps/status");

var LogStackTraces = require("../log-stack-traces");

var api = require("./api");
var Preview = require("./preview/preview-server").Preview;
var websocket = require("./websocket");

module.exports = server;
function server(options) {
    options = options || {};

    //jshint -W116
    if (!options.setupProjectWorkspace) throw new Error("options.setupProjectWorkspace required");
    var setupProjectWorkspace = options.setupProjectWorkspace;
    if (!options.config) throw new Error("options.config required");
    var config = options.config;
    //jshint +W116

    var preview = Preview(config);

    var chain = joey
    .error()
    // Put here to avoid printing logs when HAProxy pings the server for
    // a health check
    .route(function () {
        this.OPTIONS("").content("");
    })
    .log(log, function (message) { return message; })
    .use(LogStackTraces(log))
    .tap(setupProjectWorkspace)
    .route(function (route) {
        var fs = require("q-io/fs");

        var serveProject = preview(function (request) {
            // Strip leading slash on pathInfo so that the `join` works
            var path = fs.join("/workspace", request.pathInfo.replace(/^\//, ""));
            log("serveProject path", path);

            return fs.isFile(path).then(function(isFile) {
                if (isFile) {
                    return HttpApps.file(request, path, null, fs);
                } else {
                    return StatusApps.notFound(request);
                }
            });
        });

        route("api/...")
        .app(api(config).end());

        route("static/...")
        .app(serveProject);
    });

    var services = {};
    // Object.keys(clientServices).forEach(function (name) {
    //     services[name] = require(fs.join(client, clientServices[name]));
    // });
    services["file-service"] = require("./services/file-service");
    // services["extension-service"] = require("./services/extension-service");
    services["env-service"] = require("./services/env-service");
    services["preview-service"] = require("./services/preview-service").service;
    services["package-manager-service"] = require("./services/package-manager-service");
    services["repository-service"] = require("./services/repository-service");

    // FIXME docker clientPath
    var clientPath = "/srv/filament";
    var websocketServer = websocket(config, services, clientPath);

    chain.upgrade = function (request, socket, head) {
        console.log("websocket!!!!!!!");
        // FIXME docker preview server
        // if (endsWith(request.headers.host, environment.getProjectHost())) {
        //     // preview.wsServer.handleUpgrade(request, socket, head);
        // } else {
        websocketServer(request, socket, head);
        // }
    };

    return chain;
}

