const log = require("logging").from(__filename);
const joey = require("joey");

const HttpApps = require("q-io/http-apps/fs");
const StatusApps = require("q-io/http-apps/status");

const LogStackTraces = require("./common/log-stack-traces");

const api = require("./api");
const serveArchivedBuild = require("./mop").serveArchivedBuild;
const Preview = require("./preview/preview-server").Preview;
const WebSocket = require("faye-websocket");
const websocket = require("./websocket");
const Frontend = require("./frontend");

module.exports = (options = {}) => {
    const {
        setupProjectWorkspace,
        config,
        workspacePath,
        fs,
        request
    } = options;
    //jshint -W116
    if (!setupProjectWorkspace) throw new TypeError("options.setupProjectWorkspace required");
    if (!config) throw new TypeError("options.config required");
    if (!workspacePath) throw new TypeError("options.workspacePath required");
    if (!fs) throw new TypeError("options.fs required");
    if (!request) throw new TypeError("options.request required");
    //jshint +W116

    const preview = Preview(config);

    const chain = joey
    .error()
    // Put here to avoid printing logs when HAProxy pings the server for
    // a health check
    .route(function () { 
        this.OPTIONS("").content("")
    })
    .use(LogStackTraces(log))
    .tap(setupProjectWorkspace)
    .route(function (route, _, __, POST) {
        const serveProject = preview(async (request) => {
            // Aboslute the path so that ".." components are removed, then
            // strip leading slash on pathInfo so that the `join` works
            let path = fs.absolute(decodeURI(request.pathInfo)).replace(/^\//, "");
            path = fs.join(workspacePath, path);

            const isFile = await fs.isFile(path);
            if (isFile) {
                return HttpApps.file(request, path, null, fs);
            } else {
                return StatusApps.notFound(request);
            }
        });

        route("api/...")
        .log(log, (message) => message)
        .app(api(config).end());

        route("static/...")
        .app(serveProject);

        route("build/archive")
        .app(serveArchivedBuild);

        POST("notice")
        .app(async (request) => {
            const body = await request.body.read();
            const message = JSON.parse(body.toString());
            try {
                await Frontend.showNotification(message);
            } catch (error) {
                console.error("Error notifying", error.stack);
            }
            return { status: 200, body: [] };
        });
    });

    const services = {};
    services["file-service"] = require("./services/file-service");
    services["extension-service"] = require("./services/extension-service");
    services["env-service"] = require("./services/env-service");
    services["preview-service"] = require("./services/preview-service").service;
    services["package-manager-service"] = require("./services/package-manager-service");
    services["repository-service"] = require("./services/repository-service");
    services["build-service"] = require("./services/build-service");
    services["asset-converter-service"] = require("./services/asset-converter-service");

    const websocketServer = websocket(config, workspacePath, services, request);

    chain.upgrade = async (request, socket, head) => {
        try {
            if (!WebSocket.isWebSocket(request)) {
                return;
            }
            if (request.headers['sec-websocket-protocol'] === "firefly-preview") {
                return await preview.wsServer(request, socket, head);
            } else {
                return await websocketServer(request, socket, head);
            }
        } catch (error) {
            console.error("Error setting up websocket", error.stack);
            socket.write("HTTP/1.1 500 Internal Server Error\r\n\r\n");
            socket.destroy();
        }
    };

    return chain;
}

