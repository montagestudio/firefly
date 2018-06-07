const log = require("logging").from(__filename);
const uuid = require("uuid");
const Frontend = require("../frontend");
const UAParser = require("ua-parser-js").UAParser;

const preview = {
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

    clearChanges() {
        this.changes = {
            queue: {},
            _initialSequenceId: 0,
            _lastSequenceId: -1
        };
    },

    disconnectAllClients() {
        for (let i = 0, ii = this.connections.length; i < ii; i++) {
            this.connections[i].ws.close();
        }
    },

    /**
     * Send a generic operation to all clients.
     */
    sendToClients(name, params) {
        const content = name + ":" + (params ? JSON.stringify(params) : "");
        this._sendToClients(content);
    },

    _sendToClients(content) {
        for (let i = 0, ii = this.connections.length; i < ii; i++) {
            this.connections[i].ws.send(content);
        }
    },

    sendToClient(clientId, name, params) {
        const content = name + ":" + (params ? JSON.stringify(params) : "");
        this._sendToClient(clientId, content);
    },

    _sendToClient(clientId, content) {
        for (let i = 0, ii = preview.connections.length; i < ii; i++) {
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
    sendChangeToClients(name, params) {
        let content;
        const sequenceId = ++this.changes._lastSequenceId;
        if (!params) {
            params = {};
        }
        params.sequenceId = sequenceId;
        content = name + ":" + JSON.stringify(params);
        this.changes.queue[sequenceId] = content;
        this._sendToClients(content);
    },

    /**
     * Send all changes the preview has stored since `fromSequenceId`
     * (including) to a client.
     */
    sendChangesToClient(client, fromSequenceId) {
        if (!this.changes) {
            return;
        }
        const toSequenceId = this.changes._lastSequenceId;
        const queue = this.changes.queue;
        log("send changes [" + fromSequenceId + "," + toSequenceId + "]");
        for (let i = fromSequenceId; i <= toSequenceId; i++) {
            if (queue[i]) {
                client.ws.send(queue[i]);
            }
        }
    }
};

exports.registerConnection = function(ws, request) {
    const client = {
        ws: ws,
        info: {
            clientId: uuid.v4(),
            userAgent: request.headers['user-agent'],
            browser: browserNameForUserAgent(request.headers['user-agent']),
            remoteAddress: request.connection.remoteAddress,
            xForwardedFor: request.headers['x-forwarded-for']
        }
    };
    preview.connections.push(client);
    preview.sendChangesToClient(client, preview.changes._initialSequenceId);
    Frontend.dispatchEventNamed("previewClientConnected", true, false, client.info);
};

exports.unregisterConnection = function(ws) {
    const connections = preview.connections;
    for (const i in connections) {
        if (connections[i].ws === ws) {
            const client = connections.splice(i, 1)[0];

            Frontend.dispatchEventNamed("previewClientDisconnected", true, false, client.info);
        }
    }
};

// For testing
exports._getPreview = () => preview;

let uaParser = null;
function browserNameForUserAgent(userAgent) {
    if (!uaParser) {
        uaParser = new UAParser();
    }
    uaParser.setUA(userAgent);
    return uaParser.getBrowser().name;
}

/**
 * The actual service for the tool. We don't put the previous functions exposed
 * in the service because they're not meant to be available to anyone there.
 * There is the possibility that someone could just craft the right connection
 * object and unregister any preview connection, even if it's not theirs.
 */
exports.service = function PreviewService() {
    return {
        register() {
            log("register new preview");
            preview.clearChanges();
            this.refresh();
        },

        unregister() {
            log("unregister preview");
            preview.disconnectAllClients();
        },

        refresh() {
            preview.sendToClients("refresh");
        },

        selectComponentToInspect(clientId) {
            preview.sendToClient(clientId, "selectComponentToInspect");
        },

        setObjectProperties(label, ownerModuleId, properties) {
            const params = {
                label: label,
                ownerModuleId: ownerModuleId,
                properties: properties
            };
            // Since this operation can happen at 60ops/s (because of the flow
            // editor) we don't want or need to store every single change to the
            // properties of an object for memory and performance reasons.
            // To avoid this we check if we already performed this operation to the
            // same object in the past and remove the previous operation from the
            // change set.
            const key = "setObjectProperties:" + label + "@" + ownerModuleId;
            const sequenceId = preview.changes[key];
            if (sequenceId) {
                delete preview.changes.queue[sequenceId];
            }

            preview.sendChangeToClients("setObjectProperties", params);
            preview.changes[key] = preview.changes._lastSequenceId;
        },

        setObjectProperty(ownerModuleId, label, propertyName, propertyValue, propertyType) {
            const params = {
                ownerModuleId: ownerModuleId,
                label: label,
                propertyName: propertyName,
                propertyValue: propertyValue,
                propertyType: propertyType
            };
            preview.sendChangeToClients("setObjectProperty", params);
        },

        setObjectLabel(ownerModuleId, label, newLabel) {
            const params = {
                ownerModuleId: ownerModuleId,
                label: label,
                newLabel: newLabel
            };
            preview.sendChangeToClients("setObjectLabel", params);
        },

        setObjectBinding(ownerModuleId, label, binding) {
            const params = {
                ownerModuleId: ownerModuleId,
                label: label,
                binding: binding
            };
            preview.sendChangeToClients("setObjectBinding", params);
        },

        deleteObjectBinding(ownerModuleId, label, path) {
            const params = {
                ownerModuleId: ownerModuleId,
                label: label,
                path: path
            };
            preview.sendChangeToClients("deleteObjectBinding", params);
        },

        addTemplateFragment(moduleId, elementLocation, how, templateFragment) {
            const params = {
                moduleId: moduleId,
                elementLocation: elementLocation,
                how: how,
                templateFragment: templateFragment
            };
            preview.sendChangeToClients("addTemplateFragment", params);
        },

        addTemplateFragmentObjects(moduleId, templateFragment) {
            const params = {
                moduleId: moduleId,
                templateFragment: templateFragment
            };
            preview.sendChangeToClients("addTemplateFragmentObjects", params);
        },

        deleteObject(ownerModuleId, label) {
            const params = {
                ownerModuleId: ownerModuleId,
                label: label
            };
            preview.sendChangeToClients("deleteObject", params);
        },

        deleteElement(ownerModuleId, elementLocation) {
            const params = {
                ownerModuleId: ownerModuleId,
                elementLocation: elementLocation
            };
            preview.sendChangeToClients("deleteElement", params);
        },

        setElementAttribute(moduleId, elementLocation, attributeName, attributeValue) {
            const params = {
                moduleId: moduleId,
                elementLocation: elementLocation,
                attributeName: attributeName,
                attributeValue: attributeValue
            };
            preview.sendChangeToClients("setElementAttribute", params);
        },

        addObjectEventListener(moduleId, label, type, listenerLabel, useCapture) {
            const params = {
                moduleId: moduleId,
                label: label,
                type: type,
                listenerLabel: listenerLabel,
                useCapture: useCapture
            };
            preview.sendChangeToClients("addObjectEventListener", params);
        },

        removeObjectEventListener(moduleId, label, type, listenerLabel, useCapture) {
            const params = {
                moduleId: moduleId,
                label: label,
                type: type,
                listenerLabel: listenerLabel,
                useCapture: useCapture
            };
            preview.sendChangeToClients("removeObjectEventListener", params);
        },

        didSaveProject() {
            preview.clearChanges();
        },

        updateCssFileContent(url, content) {
            const params = {
                url: url,
                content: content
            };
            // Since this operation can happen quite a lot with big chunks of
            // content it could potentially make the queue store big amounts of
            // data that are not necessary because each change on an url
            // invalidates the previous change made to the same url.
            // To avoid this we check if we already performed this operation to the
            // same object in the past and remove the previous operation from the
            // change set.
            const key = "updateCssFileContent:" + url;
            const sequenceId = preview.changes[key];
            if (sequenceId) {
                delete preview.changes.queue[sequenceId];
            }

            preview.sendChangeToClients("updateCssFileContent", params);
            preview.changes[key] = preview.changes._lastSequenceId;
        },

        getClients() {
            return preview.connections.map(connection => connection.info);
        },

        close() {
            this.unregister();
        }
    };
}
