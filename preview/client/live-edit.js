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

        getObjectsByLabel: {
            value: function(label) {
                return this.rootComponent.querySelectorAllComponent("@" + label);
            }
        },

        setObjectProperties: {
            value: function(label, ownerModuleId, properties) {
                var objects = this.getObjectsByLabel(label),
                    objectOwnerModuleId;

                for (var i = 0, object; (object = objects[i]); i++) {
                    objectOwnerModuleId = object.ownerComponent._montage_metadata.moduleId; //jshint ignore:line

                    if (objectOwnerModuleId === ownerModuleId) {
                        for (var key in properties) {
                            if (properties.hasOwnProperty(key)) {
                                object[key] = properties[key];
                            }
                        }
                    }
                }
            }
        }
    });
})(window.Declarativ);