/*global module, unescape*/
var log = require("logging").from(__filename);
var Q = require("q");
var FS = require("q-io/fs");
var URL = require("url");
var HttpApps = require("q-io/http-apps/fs");
var StatusApps = require("q-io/http-apps/status");
var RedirectApps = require("q-io/http-apps/redirect");
var ws = require("websocket.io");
var preview = require("../services/preview-service");
var hasPreviewAccess = require("./check-preview-access").hasPreviewAccess;
var querystring = require("querystring");

var CLIENT_FILES = "{$PREVIEW}";

var CLIENT_ROOT = __dirname + "/client/";

var clientFs = FS.reroot(CLIENT_ROOT);

module.exports.Preview = Preview;
module.exports.servePreviewAccessForm = servePreviewAccessForm;
module.exports.processAccessRequest = processAccessRequest;
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
function Preview(sessions) {
    var use = function(next) {
        return function(request, response) {
            var path = unescape(request.path);

            if (path.indexOf("/" + CLIENT_FILES + "/") === 0) {
                return servePreviewClientFile(request, response);
            }

            return Q.when(next(request, response), function(response) {
                if (response.body && path === "/index.html") {
                    return injectPreviewScripts(request, response);
                } else {
                    return response;
                }
            });
        };
    };

    use.wsServer = startWsServer(sessions);
    return use;
}

function injectScriptInHtml(src, html) {
    var index = html.toLowerCase().indexOf("</head>");

    if (index !== -1) {
        html = html.substring(0, index) +
            '<script type="text/javascript" src="' + src + '"></script>\n' +
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
        var liveEditSrc = request.scheme + "://" + request.host + "/" + CLIENT_FILES + "/live-edit.js";
        var previewSrc = request.scheme + "://" + request.host + "/" + CLIENT_FILES + "/preview.js";

        html = injectScriptInHtml(liveEditSrc, html);
        html = injectScriptInHtml(previewSrc, html);
        response.body = [html];
        response.headers['content-length'] = html.length;
        return response;
    });
}

function servePreviewClientFile(request, response) {
    var path = unescape(request.path);

    return clientFs.then(function(fs) {
        path = path.slice(("/" + CLIENT_FILES + "/").length);

        if (path === "") {
            var deferredResponse = Q.defer();
            preview.registerDeferredResponse(request.headers.host, deferredResponse);
            return deferredResponse.promise;
        } else if (path === "preview.js" || path === "live-edit.js") {
            return HttpApps.file(request, path, null, fs);
        }

        return StatusApps.notFound(request);
    });
}

function servePreviewAccessForm(request) {
    return clientFs.then(function(fs) {
        return HttpApps.file(request, "access.html", null, fs);
    });
}

function processAccessRequest(request) {
    // Get code from the body data
    return request.body.read()
    .then(function(body) {
        if (body.length > 0) {
            var query = querystring.parse(body.toString());

            maybeGrantAccessToPreview(
                query.code, request.headers.host, request.session);
        }

        // 302 - Temporary redirect using GET
        return RedirectApps.temporaryRedirect(request, "index.html", 302);
    });
}

function maybeGrantAccessToPreview(code, previewHost, session) {
    var accessCode = preview.getPreviewAccessCodeFromUrl(previewHost);

    if (code && accessCode && code === accessCode) {
        if (session.previewAccess) {
            if (session.previewAccess.indexOf(previewHost) === -1) {
                session.previewAccess.push(previewHost);
            }
        } else {
            session.previewAccess = [previewHost];
        }
        log("access granted ", previewHost);
        return true;
    } else {
        log("access denied");
        return false;
    }
}

function startWsServer(sessions) {
    // this server will get upgraded by project-chain
    var wsServer = new ws.Server();
    var websocketConnections = 0;

    wsServer.on('connection', function (connection) {
        var request = connection.req;
        var pathname = URL.parse(request.url).pathname;
        var remoteAddress = connection.socket.remoteAddress;


        sessions.getSession(request, function(session) {
            if (preview.existsPreviewFromUrl(request.headers.host) &&
                hasPreviewAccess(request.headers.host, session)) {
                log("websocket connection", remoteAddress, pathname, "open connections:", ++websocketConnections);

                preview.registerConnection(connection);

                connection.on('close', function () {
                    log("websocket connection closed: ", --websocketConnections);
                    preview.unregisterConnection(connection);
                });

                connection.on("error", function(err) {
                    if (err.code !== 'ECONNRESET') {
                        log("Preview connection error:", err);
                    }
                });
            } else {
                connection.close();
            }
        }).done();
    });

    return wsServer;
}
