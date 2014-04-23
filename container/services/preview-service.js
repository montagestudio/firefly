var log = require("../../logging").from(__filename);
var uuid = require("uuid");

var preview = {
    /**
     * This object holds the list of changes that were applied to the
     * application since its last save state.
     * The queue property is an object that can be indexed by the sequence
     * number of the change. Sequence numbers are in increasing order, they
     * start at _initialSequenceId and end at _lastSequenceId.
     * Entries in the queue may be deleted for optimization purposes if
     * they are considered no ops.
     * This structure is used to send past change operations to Preview clients
     * that were initialized after changes have been performed on the last save
     * point.
     */
    changes: {
        queue: {},
        _initialSequenceId: 0,
        _lastSequenceId: -1
    },
    connections: [],

    clearChanges: function() {
        this.changes = {
            queue: {},
            _initialSequenceId: 0,
            _lastSequenceId: -1
        };
    },

    disconnectAllClients: function() {
        for (var i = 0, ii = this.connections.length; i < ii; i++) {
            this.connections[i].ws.close();
        }
    },

    /**
     * Send a generic operation to all clients.
     */
    sendToClients: function(name, params) {
        var content = name + ":" + (params ? JSON.stringify(params) : "");
        this._sendToClients(content);
    },

    _sendToClients: function(content) {
        for (var i = 0, ii = this.connections.length; i < ii; i++) {
            this.connections[i].ws.send(content);
        }
    },

    sendToClient: function(clientId, name, params) {
        var content = name + ":" + (params ? JSON.stringify(params) : "");
        this._sendToClient(clientId, content);
    },

    _sendToClient: function(clientId, content) {
        for (var i = 0, ii = preview.connections.length; i < ii; i++) {
            if (preview.connections[i].info.clientId === clientId) {
                preview.connections[i].ws.send(content);
                return;
            }
        }
    },

    /**
     * Send a change command to all clients. Change operations are stored in a
     * buffer so that they can be replayed on new preview clients.
     */
    sendChangeToClients: function(name, params) {
        var content;
        var sequenceId = ++this.changes._lastSequenceId;

        if (!params) {
            params = {};
        }
        params.sequenceId = sequenceId;
        content = name + ":" + JSON.stringify(params);
        this.changes.queue[sequenceId] = content;
        this._sendToClients(content);
    },
};

exports.registerConnection = function(ws, request) {
    var client = {
        ws: ws,
        info: {
            clientId: uuid.v4(),
            userAgent: request.headers['user-agent'],
            remoteAddress: request.connection.remoteAddress,
            xForwardedFor: request.headers['x-forwarded-for']
        }
    };
    preview.connections.push(client);
};

exports.unregisterConnection = function(ws) {
    var connections = preview.connections;
    for (var i in connections) {
        if (connections[i].ws === ws) {
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
        preview.clearChanges();
        this.refresh();
    };

    service.unregister = function() {
        log("unregister preview");
        preview.disconnectAllClients();
    };

    service.refresh = function() {
        preview.sendToClients("refresh");
    };

    service.selectComponentToInspect = function(clientId) {
        preview.sendToClient(clientId, "selectComponentToInspect");
    };

    service.setObjectProperties = function(label, ownerModuleId, properties) {
        var params = {
            label: label,
            ownerModuleId: ownerModuleId,
            properties: properties
        };
        preview.sendChangeToClients("setObjectProperties", params);
    };

    service.setObjectProperty = function(ownerModuleId, label, propertyName, propertyValue, propertyType) {
        var params = {
            ownerModuleId: ownerModuleId,
            label: label,
            propertyName: propertyName,
            propertyValue: propertyValue,
            propertyType: propertyType
        };
        preview.sendChangeToClients("setObjectProperty", params);
    };

    service.setObjectLabel = function(ownerModuleId, label, newLabel) {
        var params = {
            ownerModuleId: ownerModuleId,
            label: label,
            newLabel: newLabel
        };
        preview.sendChangeToClients("setObjectLabel", params);
    };

    service.setObjectBinding = function(ownerModuleId, label, binding) {
        var params = {
            ownerModuleId: ownerModuleId,
            label: label,
            binding: binding
        };
        preview.sendChangeToClients("setObjectBinding", params);
    };

    service.deleteObjectBinding = function(ownerModuleId, label, path) {
        var params = {
            ownerModuleId: ownerModuleId,
            label: label,
            path: path
        };
        preview.sendChangeToClients("deleteObjectBinding", params);
    };

    service.addTemplateFragment = function(moduleId, elementLocation, how, templateFragment) {
        var params = {
            moduleId: moduleId,
            elementLocation: elementLocation,
            how: how,
            templateFragment: templateFragment
        };
        preview.sendChangeToClients("addTemplateFragment", params);
    };

    service.addTemplateFragmentObjects = function(moduleId, templateFragment) {
        var params = {
            moduleId: moduleId,
            templateFragment: templateFragment
        };
        preview.sendChangeToClients("addTemplateFragmentObjects", params);
    };

    service.deleteObject = function(ownerModuleId, label) {
        var params = {
            ownerModuleId: ownerModuleId,
            label: label
        };
        preview.sendChangeToClients("deleteObject", params);
    };

    service.deleteElement = function(ownerModuleId, elementLocation) {
        var params = {
            ownerModuleId: ownerModuleId,
            elementLocation: elementLocation
        };
        preview.sendChangeToClients("deleteElement", params);
    };

    service.setElementAttribute = function(moduleId, elementLocation, attributeName, attributeValue) {
        var params = {
            moduleId: moduleId,
            elementLocation: elementLocation,
            attributeName: attributeName,
            attributeValue: attributeValue
        };
        preview.sendChangeToClients("setElementAttribute", params);
    };

    service.addObjectEventListener = function(moduleId, label, type, listenerLabel, useCapture) {
        var params = {
            moduleId: moduleId,
            label: label,
            type: type,
            listenerLabel: listenerLabel,
            useCapture: useCapture
        };
        preview.sendChangeToClients("addObjectEventListener", params);
    };

    service.removeObjectEventListener = function(moduleId, label, type, listenerLabel, useCapture) {
        var params = {
            moduleId: moduleId,
            label: label,
            type: type,
            listenerLabel: listenerLabel,
            useCapture: useCapture
        };
        preview.sendChangeToClients("removeObjectEventListener", params);
    };

    service.didSaveProject = function() {
        preview.clearChanges();
    };

    service.getClients = function() {
        return preview.connections.map(function(connection) {
            return connection.info;
        });
    };

    service.close = function() {
        this.unregister();
    };

    return service;
}
