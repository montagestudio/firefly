// jshint -W106
var rootComponent = require("montage/ui/component").__root__;

module.exports.findObjects = findObjects;
module.exports.findObject = findObject;
module.exports.findOwner = findOwner;
module.exports.findOwners = findOwners;
module.exports.hasEventListener = hasEventListener;
module.exports.getMontageId = getMontageId;

function findObject(ownerModuleId, label) {
    return findObjects(ownerModuleId, label)[0];
}

function findObjects(ownerModuleId, label, parentComponent) {
    var objects = [];
    var object;
    var components;
    var component;

    if (label === "owner") {
        return findOwners(ownerModuleId, parentComponent);
    }

    parentComponent = parentComponent || rootComponent;

    // Non-components will only be available in the document part.
    if (getModuleId(parentComponent) === ownerModuleId &&
        parentComponent._templateDocumentPart) {
        object = findNonComponentInDocumentPart(label, parentComponent._templateDocumentPart);
        if (object) {
            objects.push(object);
        }
    }

    components = parentComponent.childComponents;
    for (var i = 0; component =/*assign*/ components[i]; i++) {
        if (getModuleId(component.ownerComponent) === ownerModuleId &&
            getLabel(component) === label) {
            objects.push(component);
        }
        objects = objects.concat(findObjects(ownerModuleId, label, component));
    }

    return objects;
}

function getLabel(component) {
    if (component && component._montage_metadata) {
        return component._montage_metadata.label;
    }

    return null;
}

function getModuleId(component) {
    if (component && component._montage_metadata) {
        return component._montage_metadata.moduleId;
    }

    return null;
}

function getMontageId(element) {
    if (element) {
        return element.getAttribute("data-montage-id");
    }

    return null;
}

function findOwner(moduleId, parentComponent) {
    return findOwners(moduleId, parentComponent)[0];
}

function findOwners(moduleId, parentComponent) {
    parentComponent = parentComponent || rootComponent;

    var owners = [];
    var childComponents = parentComponent.childComponents;
    var childComponent;

    for (var i = 0; childComponent =/*assign*/ childComponents[i]; i++) {
        if (getModuleId(childComponent) === moduleId) {
            owners.push(childComponent);
        }
        owners = owners.concat(findOwners(moduleId, childComponent));
    }

    return owners;
}

function findNonComponentInDocumentPart(label, documentPart) {
    var objects = documentPart.objects;
    var object = objects[label];

    // Components that do not have an element are also considered
    // "non-component".
    if (object && !(object.childComponents && object.element) ) {
        return object;
    }

    return null;
}

function hasEventListener(target, type, listener, useCapture) {
    var registeredEventListeners = target.eventManager.registeredEventListeners[type];
    var listenerRegistration;
    var listeners;

    if (registeredEventListeners) {
        if (registeredEventListeners[target.uuid]) {
            listeners = registeredEventListeners[target.uuid].listeners;
            if (listeners) {
                listenerRegistration = listeners[listener.uuid];
                if (listenerRegistration) {
                    return listenerRegistration.listener === listener &&
                        listenerRegistration.bubble !== useCapture &&
                        listenerRegistration.capture === useCapture;
                }
            }
        }
    }

    return false;
}

// jshint ignore:start
function findObjectInDocumentPart(label, documentPart) {
    var objects = documentPart.objects;
    var object;

    for (var key in objects) {
        object = objects[key];

        if (getLabel(object)) {
            key = getLabel(object);
        }

        if (key === label) {
            return object;
        }
    }

    return null;
}
// jshint ignore:end
// jshint +W106