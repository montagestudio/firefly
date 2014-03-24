var log = require("logging").from(__filename);

var preview = {};

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

// For testing
exports._getPreview = function () {
    return preview;
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
        this.refresh();
    };

    service.unregister = function() {
        log("unregister preview");
        // Websocket connections
        if (preview.connections) {
            for (var i = 0, ii = preview.connections.length; i < ii; i++) {
                preview.connections[i].close();
            }
        }
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

    service.setObjectProperty = function(ownerModuleId, label, propertyName, propertyValue, propertyType) {
        var params = {
            ownerModuleId: ownerModuleId,
            label: label,
            propertyName: propertyName,
            propertyValue: propertyValue,
            propertyType: propertyType
        };
        sendToPreviewClients("setObjectProperty:" + JSON.stringify(params));
    };

    service.setObjectLabel = function(ownerModuleId, label, newLabel) {
        var params = {
            ownerModuleId: ownerModuleId,
            label: label,
            newLabel: newLabel
        };
        sendToPreviewClients("setObjectLabel:" + JSON.stringify(params));
    };

    service.setObjectBinding = function(ownerModuleId, label, binding) {
        var params = {
            ownerModuleId: ownerModuleId,
            label: label,
            binding: binding
        };
        sendToPreviewClients("setObjectBinding:" + JSON.stringify(params));
    };

    service.deleteObjectBinding = function(ownerModuleId, label, path) {
        var params = {
            ownerModuleId: ownerModuleId,
            label: label,
            path: path
        };
        sendToPreviewClients("deleteObjectBinding:" + JSON.stringify(params));
    };

    service.addTemplateFragment = function(moduleId, elementLocation, how, templateFragment) {
        var params = {
            moduleId: moduleId,
            elementLocation: elementLocation,
            how: how,
            templateFragment: templateFragment
        };
        sendToPreviewClients("addTemplateFragment:" + JSON.stringify(params));
    };

    service.addTemplateFragmentObjects = function(moduleId, templateFragment) {
        var params = {
            moduleId: moduleId,
            templateFragment: templateFragment
        };
        sendToPreviewClients("addTemplateFragmentObjects:" + JSON.stringify(params));
    };

    service.deleteObject = function(ownerModuleId, label) {
        var params = {
            ownerModuleId: ownerModuleId,
            label: label
        };
        sendToPreviewClients("deleteObject:" + JSON.stringify(params));
    };

    service.deleteElement = function(ownerModuleId, elementLocation) {
        var params = {
            ownerModuleId: ownerModuleId,
            elementLocation: elementLocation
        };
        sendToPreviewClients("deleteElement:" + JSON.stringify(params));
    };

    service.setElementAttribute = function(moduleId, elementLocation, attributeName, attributeValue) {
        var params = {
            moduleId: moduleId,
            elementLocation: elementLocation,
            attributeName: attributeName,
            attributeValue: attributeValue
        };
        sendToPreviewClients("setElementAttribute:" + JSON.stringify(params));
    };

    service.addObjectEventListener = function(moduleId, label, type, listenerLabel, useCapture) {
        var params = {
            moduleId: moduleId,
            label: label,
            type: type,
            listenerLabel: listenerLabel,
            useCapture: useCapture
        };
        sendToPreviewClients("addObjectEventListener:" + JSON.stringify(params));
    };

    service.removeObjectEventListener = function(moduleId, label, type, listenerLabel, useCapture) {
        var params = {
            moduleId: moduleId,
            label: label,
            type: type,
            listenerLabel: listenerLabel,
            useCapture: useCapture
        };
        sendToPreviewClients("removeObjectEventListener:" + JSON.stringify(params));
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

    return service;
}
