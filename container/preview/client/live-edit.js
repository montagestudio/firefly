/*global window, montageRequire*/
if (typeof window.Declarativ === "undefined") {
    window.Declarativ = {};
}

(function(ns) {
    ns.LiveEdit = Object.create(Object.prototype, {
        _rootComponent: {
            writable: true,
            value: null
        },

        rootComponent: {
            get: function() {
                if (!this._rootComponent) {
                    this._rootComponent = montageRequire("ui/component").__root__;
                }
                return this._rootComponent;
            }
        },

        // TODO: this won't find non-components
        findObjects: {
            value: function(ownerModuleId, label) {
                if (label === "owner") {
                    return this._findObjectsByModuleId(ownerModuleId);
                } else {
                    return this._findObjectsByLabel(label, ownerModuleId);
                }
            }
        },

        _findObjectsByLabel: {
            value: function(label, ownerModuleId) {
                var objects = [];
                var findObjects = function(component) {
                    var childComponents = component.childComponents;
                    var childComponent;

                    for (var i = 0; (childComponent = childComponents[i]); i++) {
                        if (childComponent._montage_metadata.label === label &&
                            childComponent.ownerComponent._montage_metadata.moduleId === ownerModuleId) {
                            objects.push(childComponent);
                        }
                        findObjects(childComponent);
                    }
                };

                findObjects(this.rootComponent);
                return objects;
            }
        },

        _findObjectsByModuleId: {
            value: function(moduleId) {
                var objects = [];
                var findObjects = function(component) {
                    var childComponents = component.childComponents;
                    var childComponent;

                    for (var i = 0; (childComponent = childComponents[i]); i++) {
                        if (childComponent._montage_metadata.moduleId === moduleId) {
                            objects.push(childComponent);
                        }
                        findObjects(childComponent);
                    }
                };

                findObjects(this.rootComponent);
                return objects;
            }
        },

        setObjectProperties: {
            value: function(label, ownerModuleId, properties) {
                var objects = this.findObjects(ownerModuleId, label);

                for (var i = 0, object; (object = objects[i]); i++) {
                    for (var key in properties) {
                        if (properties.hasOwnProperty(key)) {
                            object[key] = properties[key];
                        }
                    }
                }
            }
        },

        setObjectBinding: {
            value: function(ownerModuleId, label, binding) {
                var objects = this.findObjects(ownerModuleId, label);

                for (var i = 0, object; (object = objects[i]); i++) {
                    if (object.getBinding(binding.propertyName)) {
                        object.cancelBinding(binding.propertyName);
                    }
                    this._defineBinding(object, binding.propertyName, binding.propertyDescriptor);
                }
            }
        },

        deleteObjectBinding: {
            value: function(ownerModuleId, label, path) {
                var objects = this.findObjects(ownerModuleId, label);

                for (var i = 0, object; (object = objects[i]); i++) {
                    if (object.getBinding(path)) {
                        object.cancelBinding(path);
                    }
                }
            }
        },

        _defineBinding: {
            value: function(object, propertyName, propertyDescriptor) {
                var objects = object._ownerDocumentPart.objects;

                propertyDescriptor.components = {
                    getObjectByLabel: function(label) {
                        return objects[label];
                    }
                };
                object.defineBinding(propertyName, propertyDescriptor);
            }
        }
    });
})(window.Declarativ);