/*global module, unescape*/
var log = require("../../logging").from(__filename);
var activity = require("../activity");

var Promise = require("bluebird");
var FS = require("q-io/fs");
var URL = require("url");
var HttpApps = require("q-io/http-apps/fs");
var StatusApps = require("q-io/http-apps/status");
var WebSocket = require("faye-websocket");
var preview = require("../services/preview-service");
var Env = require("../../environment");
var Frontend = require("../frontend");

var CLIENT_FILES = "{$PREVIEW}";

var CLIENT_ROOT = __dirname + "/client/";
var PREVIEW_SCRIPTS = [
    "preview.js",
    "montage-studio.js",
    "tools.js",
    "live-edit.js"
];

var clientFs = FS.reroot(CLIENT_ROOT);

module.exports.Preview = Preview;
// for testing
module.exports.injectPreviewScripts = injectPreviewScripts;
module.exports.servePreviewClientFile = servePreviewClientFile;

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
    var use = function(next) {
        return function(request, response) {
            var path = unescape(request.pathInfo);

            if (path.indexOf("/" + CLIENT_FILES + "/") === 0) {
                return servePreviewClientFile(request, response);
            }

            return Promise.resolve(next(request, response))
            .then(function (response) {
                if (response.body && path === "/index.html") {
                    response = injectPreviewScripts(request, response);
                }
                return response;
            });
        };
    };

    use.wsServer = startWsServer(config);
    return use;
}

function injectScriptInHtml(src, html) {
    var srcIndex = html.toLowerCase().indexOf('src="node_modules/montage/montage.js"');
    var closingIndex = html.toLowerCase().indexOf('</script>', srcIndex) + '</script>'.length;
    var selfClosingIndex = html.toLowerCase().indexOf('/>', srcIndex) + '/>'.length;
    if (selfClosingIndex === 1) {
        selfClosingIndex = Infinity;
    }
    var index = Math.min(closingIndex, selfClosingIndex);

    if (index !== -1) {
        html = html.substring(0, index) +
            '\n<script type="text/javascript" src="' + src + '"></script>' +
            html.substring(index);
    }

    return html;
}

function injectScriptSource(source, html) {
    var srcIndex = html.toLowerCase().indexOf('src="node_modules/montage/montage.js"');
    var closingIndex = html.toLowerCase().indexOf('</script>', srcIndex) + '</script>'.length;
    var selfClosingIndex = html.toLowerCase().indexOf('/>', srcIndex) + '/>'.length;
    if (selfClosingIndex === 1) {
        selfClosingIndex = Infinity;
    }
    var index = Math.min(closingIndex, selfClosingIndex);

    if (index !== -1) {
        html = html.substring(0, index) +
            '\n<script type="text/javascript">' + source + '</script>' +
            html.substring(index);
    }

    return html;
}

function injectPreviewScripts(request, response) {
    return response.body.then(function(body) {
        return body.read();
    })
    .then(function(body) {
        var html = body.toString();
        var scriptBaseSrc = "/" + CLIENT_FILES + "/";

        for (var i = 0, scriptSrc; scriptSrc =/*assign*/ PREVIEW_SCRIPTS[i]; i++) {
            html = injectScriptInHtml(scriptBaseSrc + scriptSrc, html);
        }
        if (!Env.production) {
            html = injectScriptSource("var MontageStudio = {DEVELOPMENT: true};", html);
        }

        response.body = [html];
        response.headers['content-length'] = Buffer.byteLength(html);
        return response;
    });
}

function processPreviewClientMessage(message) {
    var data = JSON.parse(message.data),
        promise;

    if (data.command === "inspectComponent") {
        promise = Frontend.inspectComponent(data.args.ownerModuleId, data.args.label);
    }

    if (promise) {
        promise.catch(function (error) {
            log("*Error processing message", error.stack);
        });
    }
}

function servePreviewClientFile(request, response) {
    var path = unescape(request.pathInfo);

    return clientFs.then(function(fs) {
        path = path.slice(("/" + CLIENT_FILES + "/").length);

        if (PREVIEW_SCRIPTS.indexOf(path) >= 0) {
            return HttpApps.file(request, path, null, fs);
        }

        return StatusApps.notFound(request);
    });
}

function startWsServer(config) {
    // this server will get upgraded by container-chain
    var websocketConnections = 0;

    return function (request, socket, body) {
        if (!WebSocket.isWebSocket(request)) {
            return;
        }
        activity.increasePreviewConnections();

        var ws = new WebSocket(request, socket, body, ["firefly-preview"]);

        var pathname = URL.parse(request.url).pathname;
        var remoteAddress = socket.remoteAddress;

        log("websocket connection", remoteAddress, pathname, "open connections:", ++websocketConnections);

        preview.registerConnection(ws, request);

        ws.on("close", function () {
            log("websocket connection closed: ", --websocketConnections);
            preview.unregisterConnection(ws);
            activity.decreasePreviewConnections();
        });
        ws.on("message", processPreviewClientMessage);
    };
}
