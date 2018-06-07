/*global module, unescape*/
const log = require("logging").from(__filename);
const activity = require("../activity");

const FS = require("q-io/fs");
const URL = require("url");
const HttpApps = require("q-io/http-apps/fs");
const StatusApps = require("q-io/http-apps/status");
const WebSocket = require("faye-websocket");
const preview = require("../services/preview-service");
const Frontend = require("../frontend");

const CLIENT_FILES = "{$PREVIEW}";

const CLIENT_ROOT = __dirname + "/client/";
const PREVIEW_SCRIPTS = [
    "preview.js",
    "montage-studio.js",
    "tools.js",
    "live-edit.js"
];

const clientFs = FS.reroot(CLIENT_ROOT);

const removeContainerIdFromPath = (path, subdomain) => unescape(path).replace(subdomain + "/", ""); // remove container id

/**
 * This file implements the functionality needed to serve the preview pages by
 * providing two "services":
 * 1) To be injected into the project-chain so that it can intercept the serving
 * of index.html file and modify it in order to include the preview specific
 * script. And to intercept requests to the CLIENT_FILES path to serve the
 * preview specific resources such as scripts.
 * 2) To provide the webservice necessary to instrumentate the preview clients.
 * This is how firefly asks all preview clients to refresh or give other
 * commands. This webservice is also served through the project-chain connection.
 */
function Preview(config) {
    const { subdomain } = config;
    const use = (next) => async (request) => {
        const path = removeContainerIdFromPath(request.pathInfo, subdomain);
        if (path.indexOf("/" + CLIENT_FILES + "/") === 0) {
            return servePreviewClientFile(request, response, subdomain);
        }
        let response = await Promise.resolve(next(request));
        if (response.body && path === "/index.html") {
            response = injectPreviewScripts(request, response, subdomain);
        }
        return response;
    };
    use.wsServer = startWsServer(config);
    return use;
}

function injectScriptInHtml(src, html) {
    const srcIndex = html.toLowerCase().indexOf('src="node_modules/montage/montage.js"');
    const closingIndex = html.toLowerCase().indexOf('</script>', srcIndex) + '</script>'.length;
    let selfClosingIndex = html.toLowerCase().indexOf('/>', srcIndex) + '/>'.length;
    if (selfClosingIndex === 1) {
        selfClosingIndex = Infinity;
    }
    const index = Math.min(closingIndex, selfClosingIndex);
    if (index !== -1) {
        html = html.substring(0, index) +
            '\n<script type="text/javascript" src="' + src + '"></script>' +
            html.substring(index);
    }
    return html;
}

function injectScriptSource(source, html) {
    const srcIndex = html.toLowerCase().indexOf('src="node_modules/montage/montage.js"');
    const closingIndex = html.toLowerCase().indexOf('</script>', srcIndex) + '</script>'.length;
    let selfClosingIndex = html.toLowerCase().indexOf('/>', srcIndex) + '/>'.length;
    if (selfClosingIndex === 1) {
        selfClosingIndex = Infinity;
    }
    const index = Math.min(closingIndex, selfClosingIndex);
    if (index !== -1) {
        html = html.substring(0, index) +
            '\n<script type="text/javascript">' + source + '</script>' +
            html.substring(index);
    }
    return html;
}

async function injectPreviewScripts(request, response, subdomain) {
    const body = await (await response.body).read();
    let html = body.toString();
    const scriptBaseSrc = subdomain + CLIENT_FILES + "/";
    for (let i = 0, scriptSrc; (scriptSrc = PREVIEW_SCRIPTS[i]); i++) {
        html = injectScriptInHtml(scriptBaseSrc + scriptSrc, html);
    }
    if (process.env.NODE_ENV !== "development" && process.env.NODE_ENV !== "staging") {
        html = injectScriptSource("const MontageStudio = {DEVELOPMENT: true};", html);
    }
    response.body = [html];
    response.headers['content-length'] = Buffer.byteLength(html);
    return response;
}

async function processPreviewClientMessage(message) {
    const data = JSON.parse(message.data);
    if (data.command === "inspectComponent") {
        try {
            await Frontend.inspectComponent(data.args.ownerModuleId, data.args.label);
        } catch (error) {
            log("*Error processing message", error.stack);
        }
    }
}

async function servePreviewClientFile(request, response, subdomain) {
    let path = removeContainerIdFromPath(request.pathInfo, subdomain);
    const fs = await clientFs;
    path = path.slice(("/" + CLIENT_FILES + "/").length);
    if (PREVIEW_SCRIPTS.indexOf(path) >= 0) {
        return HttpApps.file(request, path, null, fs);
    }
    return StatusApps.notFound(request);
}

function startWsServer() {
    // this server will get upgraded by container-chain
    let websocketConnections = 0;

    return (request, socket, body) => {
        if (!WebSocket.isWebSocket(request)) {
            return;
        }
        activity.increasePreviewConnections();

        const ws = new WebSocket(request, socket, body, ["firefly-preview"]);
        const pathname = URL.parse(request.url).pathname;
        const remoteAddress = socket.remoteAddress;
        log("websocket connection", remoteAddress, pathname, "open connections:", ++websocketConnections);
        preview.registerConnection(ws, request);

        ws.on("close", () => {
            log("websocket connection closed: ", --websocketConnections);
            preview.unregisterConnection(ws);
            activity.decreasePreviewConnections();
        });
        ws.on("message", processPreviewClientMessage);
    };
}

module.exports.Preview = Preview;
// for testing
module.exports.injectPreviewScripts = injectPreviewScripts;
module.exports.servePreviewClientFile = servePreviewClientFile;
