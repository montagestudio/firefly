var log = require("logging").from(__filename);
var environment = require("../environment");

var _previews = {"/": {name:"/", path:"/", default:"index.html"}};

exports._previews = _previews;

exports.unregisterAllConnections = function() {
    Object.keys(_previews).forEach(function(previewId) {
        if (previewId !== "/") {
            delete _previews[previewId];
        }
    });
};

exports.registerConnection = function(connection) {
    var previewId = exports.getPreviewIdFromUrl(connection.req.headers.host),
        preview = _previews[previewId];

    if (preview) {
        if (!preview.connections) {
            preview.connections = [connection];
        } else {
            preview.connections.push(connection);
        }
    }
};

exports.unregisterConnection = function(connection) {
    var previewId = exports.getPreviewIdFromUrl(connection.req.headers.host),
        preview = _previews[previewId];

    if (preview) {
        var connections = preview.connections;
        for (var i in connections) {
            if (connections[i] === connection) {
                connections.splice(i, 1);
            }
        }
    }
};

exports.getPreviewIdFromUrl = function(url) {
    var details = environment.getDetailsfromProjectUrl(url);

    return details.owner + "-" + details.repo;
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

        log("register new preview", previewId);
        _previews[previewId] = {
            name: name,
            url: url
        };

        //saveMap();
    };

    service.unregister = function(url) {
        var previewId = exports.getPreviewIdFromUrl(url);

        log("unregister preview", previewId);
        delete _previews[previewId];

        //saveMap();
    };

    service.refresh = function(url) {
        sendToPreviewClients(url, "refresh:");
    };

    function sendToPreviewClients(url, content) {
        var previewId = exports.getPreviewIdFromUrl(url);
        var preview = _previews[previewId];

        if (preview) {
            // Websocket connections
            for (var i = 0, ii = preview.connections.length; i < ii; i++) {
                preview.connections[i].send(content);
            }
        }
    }

    return service;
}