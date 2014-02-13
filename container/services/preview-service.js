var log = require("logging").from(__filename);
var APPS = require("q-io/http-apps");

var _previews = {"/": {name:"/", path:"/", default:"index.html"}};
var registerDeferredRequestTimer;
var DEFERRED_REQUEST_TIMEOUT = 10000;

exports._previews = _previews;

exports.unregisterAllConnections = function() {
    Object.keys(_previews).forEach(function(previewId) {
        if (previewId !== "/") {
            delete _previews[previewId];
        }
    });
};

exports.registerConnection = function(ws) {
    var previewId = exports.getPreviewIdFromUrl(),
        preview = _previews[previewId];

    if (preview) {
        if (!preview.connections) {
            preview.connections = [ws];
        } else {
            preview.connections.push(ws);
        }
    }
};

exports.unregisterConnection = function(ws) {
    var previewId = exports.getPreviewIdFromUrl(),
        preview = _previews[previewId];

    if (preview) {
        var connections = preview.connections;
        for (var i in connections) {
            if (connections[i] === ws) {
                connections.splice(i, 1);
            }
        }
    }
};


exports.existsPreviewFromUrl = function(url) {
    var previewId = exports.getPreviewIdFromUrl(url);
    return previewId in _previews;
};

exports.getPreviewAccessCodeFromUrl = function(url) {
    var previewId = exports.getPreviewIdFromUrl(url),
        preview = _previews[previewId];

    if (preview) {
        return preview.accessCode;
    }
};

exports.getPreviewIdFromUrl = function(url) {
    // var details = environment.getDetailsfromProjectUrl(url);

    return "XXXX";
};

/**
 * The actual service for the tool. We don't put the previous functions exposed
 * in the service because they're not meant to be available to anyone there.
 * There is the possibility that someone could just craft the right connection
 * object and unregister any preview connection, even if it's not theirs.
 */
exports.service = PreviewService;

function PreviewService() {
    var service = {};

    service.register = function(parameters) {
        var name = parameters.name,
            url = parameters.url,
            previewId = exports.getPreviewIdFromUrl(url);

        if (previewId in _previews) {
            // Another instance of the same project was open in the tool...
            // We don't support this until we can have a 1:1 on project<->app
            this.unregister(url);
        }

        log("register new preview", previewId);
        _previews[previewId] = {
            name: name,
            url: url,
            accessCode: generateAccessCode()
        };
        log("access code: ", _previews[previewId].accessCode);
        //saveMap();
    };

    service.unregister = function(url) {
        var previewId = exports.getPreviewIdFromUrl(url);
        var preview = _previews[previewId];

        if (preview) {
            log("unregister preview", previewId);
            // Websocket connections
            if (preview.connections) {
                for (var i = 0, ii = preview.connections.length; i < ii; i++) {
                    preview.connections[i].close();
                }
            }
            delete _previews[previewId];
        }

        //saveMap();
    };

    service.refresh = function(url) {
        sendToPreviewClients(url, "refresh:");
    };

    service.setObjectProperties = function(url, label, ownerModuleId, properties) {
        var params = {
            label: label,
            ownerModuleId: ownerModuleId,
            properties: properties
        };
        sendToPreviewClients(url, "setObjectProperties:" + JSON.stringify(params));
    };

    service.close = function(request) {
        this.unregister(request.headers.host);
    };

    function sendToPreviewClients(url, content) {
        var previewId = exports.getPreviewIdFromUrl(url);
        var preview = _previews[previewId];

        if (preview) {
            // Websocket connections
            if (preview.connections) {
                for (var i = 0, ii = preview.connections.length; i < ii; i++) {
                    preview.connections[i].send(content);
                }
            }
        }
    }

    var accessCodeTable = [];
    //jshint -W004
    for (var i = 0; i < 26; i++) {
        accessCodeTable.push(String.fromCharCode(97+i));
    }
    //jshint +W004

    function generateAccessCode() {
        // FIXME: This is easy to defeat.
        var code = [];

        for (var i = 0; i < 8; i++) {
            var ix = Math.floor(Math.random() * accessCodeTable.length);
            code.push(accessCodeTable[ix]);
        }

        return code.join("");
    }

    return service;
}
