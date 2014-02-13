var log = require("logging").from(__filename);

var preview = {};
exports._preview = preview;

exports.registerConnection = function(ws) {
    if (!preview.connections) {
        preview.connections = [ws];
    } else {
        preview.connections.push(ws);
    }
};

exports.unregisterConnection = function(ws) {
    var connections = preview.connections;
    for (var i in connections) {
        if (connections[i] === ws) {
            connections.splice(i, 1);
        }
    }
};

exports.getPreviewAccessCode = function () {
    return preview.accessCode;
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

    service.register = function() {
        log("register new preview");
        preview = {
            accessCode: generateAccessCode()
        };
        log("access code: ", preview.accessCode);
    };

    service.unregister = function() {
        log("unregister preview");
        // Websocket connections
        if (preview.connections) {
            for (var i = 0, ii = preview.connections.length; i < ii; i++) {
                preview.connections[i].close();
            }
        }
        preview = {};
    };

    service.refresh = function() {
        sendToPreviewClients("refresh:");
    };

    service.setObjectProperties = function(label, ownerModuleId, properties) {
        var params = {
            label: label,
            ownerModuleId: ownerModuleId,
            properties: properties
        };
        sendToPreviewClients("setObjectProperties:" + JSON.stringify(params));
    };

    service.close = function(request) {
        this.unregister();
    };

    function sendToPreviewClients(content) {
        // Websocket connections
        if (preview.connections) {
            for (var i = 0, ii = preview.connections.length; i < ii; i++) {
                preview.connections[i].send(content);
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
