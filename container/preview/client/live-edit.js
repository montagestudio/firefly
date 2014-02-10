/*global window, montageRequire, document, XPathResult, Declarativ */
window.MONTAGE_LE_FLAG = true;
if (typeof window.Declarativ === "undefined") {
    window.Declarativ = {};
}

Object.defineProperties(window.Declarativ, {
    _Deserializer: {
        value: null,
        writable: true
    },

    Deserializer: {
        get: function() {
            if (!this._Deserializer) {
                this._Deserializer = montageRequire("core/serialization").Deserializer;
            }

            return this._Deserializer;
        }
    },

    _Promise: {
        value: null,
        writable: true
    },

    Promise: {
        get: function() {
            if (!this._Promise) {
                this._Promise = montageRequire.require("core/promise").Promise;
            }

            return this._Promise;
        }
    }
});

(function(ns) {
    var ATTR_LE_COMPONENT = "data-montage-le-component";

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

        findNodes: {
            value: function(moduleId, cssSelector) {
                var moduleIdSelector = "*[" + ATTR_LE_COMPONENT + "='" + moduleId + "']";
                cssSelector = cssSelector.replace(":scope", moduleIdSelector);

                return document.querySelectorAll(cssSelector);
            }
        },

        _findParentComponent: {
            value: function(node) {
                while (node = /*assignment*/ node.parentNode) {
                    if (node.component) {
                        return node.component;
                    }
                }

                return null;
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
        },

        addTemplateFragmentToComponentArgument: {
            value: function(ownerModuleId, label, argumentName, cssSelector, how, templateFragment) {

            }
        },

        addTemplateFragment: {
                var nodes = this.findNodes(moduleId, cssSelector);
            value: function(moduleId, label, argumentName, cssSelector, how, templateFragment) {
                var template = new Template(templateFragment.serialization,
                    templateFragment.html);

                for (var i = 0, node; (node = nodes[i]); i++) {
                    var owner = this._findParentComponent(node);
                    this._addTemplateToElement(template, node, how, owner);
                }
            }
        },

        /**
         * @param how string 'on', 'before', 'after', 'append'
         */
        _addTemplateToElement: {
            value: function(template, anchor, how, owner) {
                var self = this;

                var startTime = window.performance.now();
                return template.instantiateIntoDocument(anchor, how, owner)
                    .then(function(objects) {
                        var endTime = window.performance.now();
                        self._updateOwnerObjects(owner, objects);
                        console.log("_addTemplateToElement() ", endTime - startTime);
                    });
            }
        },

        _updateOwnerObjects: {
            value: function(owner, objects) {
                var documentPartObjects = owner._templateDocumentPart.objects;

                owner._addTemplateObjects(objects);
                for (var key in objects) {
                    documentPartObjects[key] = objects[key];
                }
            }
        }
    });

    function Template(serializationString, html) {
        this.html = html;
        this.serializationString = serializationString;
    }

    Template.prototype.instantiateIntoDocument = function(anchor, how, owner) {
        var self = this,
            element,
            elementIsWrapper;

        if (how === "on") {
            element = anchor;
        } else {
            elementIsWrapper = true;
            element = document.createElement("div");
            element.innerHTML = this.html;
            this._addElement(element, anchor, how);
        }

        if (this.serializationString) {
            return this.instantiate(owner, element)
                .then(function(objects) {
                    if (elementIsWrapper) {
                        self._removeElementWrapper(element);
                    }
                    return objects;
                });
        } else {
            return Declarativ.Promise.resolve();
        }
    };

    Template.prototype.instantiate = function(owner, element) {
        var self = this;
        var deserializer = new Declarativ.Deserializer();

        deserializer.init(this.serializationString, require);
        return deserializer.deserialize({owner: owner}, element)
            .then(function(objects) {
                self._invokeDelegates(owner, objects);
                // TODO: call setupTemplateObjects when it's ready to accept an
                // object instead of creating a new one.
                return objects;
            });
    };

    Template.prototype._invokeDelegates = function(owner, objects) {
        var documentPart = owner._templateDocumentPart;

        for (var label in objects) {
            var object = objects[label];

            if (object) {
                if (typeof object._deserializedFromTemplate === "function") {
                    object._deserializedFromTemplate(owner, label, documentPart);
                }
                if (typeof object.deserializedFromTemplate === "function") {
                    object.deserializedFromTemplate(owner, label, documentPart);
                }
            }
        }
    };

    Template.prototype._addElement = function(element, anchor, how) {
        if (how === "before") {
            anchor.parentNode.insertBefore(element, anchor);
        } else if (how === "after") {
            anchor.parentNode.insertBefore(element, anchor.nextSibling);
        } else if (how === "append") {
            anchor.appendChild(element);
        }
    };

    Template._range = document.createRange();

    Template.prototype._removeElementWrapper = function(element) {
        var range = Template._range;

        range.selectNodeContents(element);
        element.parentNode.insertBefore(range.extractContents(), element);
        element.parentNode.removeChild(element);
    };
})(window.Declarativ);