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
    var ATTR_LE_ARG = "data-montage-le-arg";
    var ATTR_LE_ARG_BEGIN = "data-montage-le-arg-begin";
    var ATTR_LE_ARG_END = "data-montage-le-arg-end";

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
            value: function(moduleId, label, argumentName, cssSelector) {
                var moduleIdSelector;

                if (label === "owner") {
                    moduleIdSelector = "*[" + ATTR_LE_COMPONENT + "='" + moduleId + "']";
                } else if (argumentName) {
                    moduleIdSelector = "*[" + ATTR_LE_ARG + "='" + moduleId + "," + label + "," + argumentName + "']";
                } else {
                    moduleIdSelector = "*[" + ATTR_LE_ARG_BEGIN + "~='" + moduleId + "," + label + "']";
                }

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

        _findParentComponentWithModuleId: {
            value: function(node, moduleId) {
                while (node = /*assignment*/ node.parentNode) {
                    if (node.component && node.component._montage_metadata.moduleId === moduleId) {
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
            value: function(moduleId, label, argumentName, cssSelector, how, templateFragment) {
                var nodes = this.findNodes(moduleId, label, argumentName,
                    cssSelector);
                var template = new Template(templateFragment.serialization,
                    templateFragment.html);

                for (var i = 0, node; (node = nodes[i]); i++) {
                    var owner = this._findParentComponentWithModuleId(
                        node, moduleId);
                    this._addTemplateToElement(template, node, how, owner, label);
                }
            }
        },

        /**
         * @param how string 'on', 'before', 'after', 'append'
         */
        _addTemplateToElement: {
            value: function(template, anchor, how, owner, label) {
                var self = this;

                var startTime = window.performance.now();
                return template.instantiateIntoDocument(anchor, how, owner)
                    .then(function(result) {
                        var endTime = window.performance.now();
                        self._updateOwnerObjects(owner, result.objects);
                        if (label !== "owner") {
                            self._updateLiveEditTags(result.firstElement,
                                result.lastElement, owner, label);
                        }
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
        },

        _updateLiveEditTags: {
            value: function(firstElement, lastElement, owner, label) {
                var leArgRangeValue = owner._montage_metadata.moduleId + "," + label;
                var nextSibling = lastElement.nextElementSibling;
                var previousSibling = firstElement.previousElementSibling;

                this._updateLiveEditRangeTags(ATTR_LE_ARG_BEGIN,
                    leArgRangeValue, firstElement, nextSibling);
                this._updateLiveEditRangeTags(ATTR_LE_ARG_END, leArgRangeValue,
                    lastElement, previousSibling);
            }
        },

        /**
         * The new content needs to be tagged with the argument range attributes
         * if it expanded the argument from the sides. This means that it is
         * now the new firstElement or the new lastElement of the star argument.
         */
        _updateLiveEditRangeTags: {
            value: function(fringeAttrName, fringeAttrValue, newFringe, currentFringe) {
                var tagNewFringe;

                if (currentFringe) {
                    var leArgValue = currentFringe.getAttribute(fringeAttrName);
                    if (leArgValue) {
                        var values = leArgValue.split(/\s+/);
                        var ix = values.indexOf(fringeAttrValue);
                        if (ix >= 0) {
                            values.splice(ix, 1);
                            currentFringe.setAttribute(fringeAttrName, values.join(" "));
                            tagNewFringe = true;
                        }
                    }
                } else {
                    tagNewFringe = true;
                }

                if (tagNewFringe) {
                    newFringe.setAttribute(fringeAttrName, fringeAttrValue);
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
                    var result = {
                        objects: objects,
                    };

                    if (elementIsWrapper) {
                        result.firstElement = element.firstElementChild;
                        result.lastElement = element.lastElementChild;
                        self._removeElementWrapper(element);
                    } else {
                        result.firstElement = result.lastElement = element;
                    }

                    return result;
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