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
                this._Promise = montageRequire("core/promise").Promise;
            }

            return this._Promise;
        }
    },

    _Alias: {
        value: null,
        writable: true
    },

    Alias: {
        get: function() {
            if (!this._Alias) {
                this._Alias = montageRequire("core/serialization/alias").Alias;
            }

            return this._Alias;
        }
    }
});

(function(ns) {
    var ATTR_LE_COMPONENT = "data-montage-le-component";
    var ATTR_LE_ARG = "data-montage-le-arg";
    var ATTR_LE_ARG_BEGIN = "data-montage-le-arg-begin";
    var ATTR_LE_ARG_END = "data-montage-le-arg-end";

    var LiveEdit = ns.LiveEdit = Object.create(Object.prototype, {
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

        findNodeDocumentPart: {
            value: function(ownerModuleId, node) {
                var component = this._findParentComponent(node),
                    iteration;

                //jshint -W106
                while (component._montage_metadata.moduleId !== ownerModuleId) {
                    if (component.clonesChildComponents) {
                        iteration = component._findIterationContainingElement(node);
                        return iteration._templateDocumentPart;
                    } else if (this._isComponentPartOfIteration(component)) {
                        return component._ownerDocumentPart;
                    }
                    component = component.ownerComponent;
                }
                //jshint +W106

                return component._templateDocumentPart;
            }
        },

        findIterationContainingNode: {
            value: function(node) {
                var component = this._findParentComponent(node);

                //jshint -W106
                do {
                    if (component.clonesChildComponents) {
                        return component._findIterationContainingElement(node);
                    }
                } while (component = /* assignment */ component.parentComponent);
                //jshint +W106

                return null;
            }
        },

        _isNodePartOfIteration: {
            value: function(ownerModuleId, node) {
                var component = this._findParentComponent(node);

                //jshint -W106
                while (component._montage_metadata.moduleId !== ownerModuleId) {
                    if (component.clonesChildComponents ||
                        this._isComponentPartOfIteration(component)) {
                        return true;
                    }
                    component = component.ownerComponent;
                }
                //jshint +W106

                return false;
            }
        },

        _isComponentPartOfIteration: {
            value: function(component) {
                // The ownerDocumentPart of a component is the DocumentPart of
                // the template scope where the component was instantiated, if
                // this doesn't match the DocumentPart of the owner it means
                // this it was not instantiated in the scope of the owner's
                // template but rather in the context of an iteration template.
                return component._ownerDocumentPart !== component.ownerComponent._templateDocumentPart;
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
                var self = this;
                var ownerDocumentPart = object._ownerDocumentPart;
                var owner = object.ownerComponent;

                propertyDescriptor.components = {
                    getObjectByLabel: function(label) {
                        return self._getObjectForBinding(owner,
                            ownerDocumentPart, label);
                    }
                };
                object.defineBinding(propertyName, propertyDescriptor);
            }
        },

        _getObjectForBinding: {
            value: function(owner, ownerDocumentPart, label) {
                var templateProperty;

                if (label.indexOf(":") > 0) {
                    templateProperty = this._resolveTemplatePropertyLabel(
                        ownerDocumentPart, label, owner);
                    if (!templateProperty) {
                        return;
                    }
                    label = templateProperty.label;
                    owner = templateProperty.owner;
                }

                return this._lookupObjectInScope(ownerDocumentPart, label, owner);
            }
        },

        /**
         * Resolves the alias template property to its final form.
         * It returns the resolved label and respective owner.
         */
        _resolveTemplatePropertyLabel: {
            value: function(documentPart, label, owner) {
                var ix = label.indexOf(":");
                var objectLabel = label.substr(0, ix);
                var propertyLabel = label.substr(ix);
                var alias;
                var object;
                var objectDocumentPart;

                object = this._lookupObjectInScope(documentPart, objectLabel,
                    owner);

                // TODO: since the repetition has nodes that are not in the
                // document but still in the component tree we can get into
                // this situation where we're not able to lookup the object.
                // This is a bug in the repetition. MON-607
                if (!object) {
                    return;
                }

                objectDocumentPart = object._templateDocumentPart;
                if (objectDocumentPart) {
                    alias = objectDocumentPart.objects[propertyLabel];
                }

                if (alias instanceof Declarativ.Alias) {
                    // Strip the @ prefix
                    label = alias.value.substr(1);
                    return this._resolveTemplatePropertyLabel(documentPart,
                        label, object);
                } else {
                    return {
                        label: label,
                        owner: owner
                    };
                }
            }
        },

        /**
         * Lookup the label/owner object through the document part chain.
         * It starts at the documentPart given and stops at the owner's
         * document part.
         */
        _lookupObjectInScope: {
            value: function(documentPart, label, owner) {
                var object,
                    ownerDocumentPart = owner._templateDocumentPart;

                do {
                    object = this._getObjectFromScope(documentPart, label, owner);
                } while (!object && documentPart !== ownerDocumentPart &&
                    (documentPart = /*assign*/documentPart.parentDocumentPart));

                return object;
            }
        },

        /**
         * Get an object by label/owner in the document part given if it exists.
         */
        _getObjectFromScope: {
            value: function(documentPart, label, owner) {
                var objects = documentPart.objects;
                var scopeOwner = objects.owner;
                var object;

                var objectMatches = function(object, objectLabel) {
                    //jshint -W106
                    var metadata = object._montage_metadata;
                    //jshint +W106
                    // Only components have label in their montage metadata.
                    if (metadata && metadata.label) {
                        objectLabel = metadata.label;
                    }
                    return objectLabel === label &&
                        (object.ownerComponent || scopeOwner) === owner;
                };

                // Let's try the fast track first, this is when the object
                // maintains the same label it got in the original declaration.
                object = objects[label];
                if (object && objectMatches(object, label)) {
                    return object;
                }

                // Let's go for the slow track then, need to search all objects
                // define in this scope to check its original label. The object
                // might be an argument that replaced a parameter (repetition
                // will do this).
                for (var name in objects) {
                    object = objects[name];
                    if (objectMatches(object, name)) {
                        return object;
                    }
                }

                return null;
            }
        },

        addTemplateFragment: {
            value: function(moduleId, label, argumentName, cssSelector, how, templateFragment) {
                var nodes = this.findNodes(moduleId, label, argumentName,
                    cssSelector);
                var template = new Template(templateFragment.serialization,
                    templateFragment.html);
                var promises = [];

                for (var i = 0, node; (node = nodes[i]); i++) {
                    var owner = this._findParentComponentWithModuleId(
                        node, moduleId);
                    promises.push(
                        this._addTemplateToElement(template, node, how, owner, label)
                    );
                }

                return Declarativ.Promise.all(promises);
            }
        },

        addTemplateFragmentObjects: {
            value: function(moduleId, templateFragment) {
                var objects = this.findObjects(moduleId, "owner");
                var template = new Template(templateFragment.serialization);
                var promises = [];

                template.removeComponentElementReferences();
                for (var i = 0, owner; (owner = objects[i]); i++) {
                    promises.push(
                        this._addTemplateObjectsToOwner(template, owner)
                    );
                }

                return Declarativ.Promise.all(promises);
            }
        },

        setElementAttribute: {
            value: function(moduleId, label, argumentName, cssSelector, attributeName, attributeValue) {
                var nodes = this.findNodes(moduleId, label, argumentName,
                    cssSelector);

                for (var i = 0, node; (node = nodes[i]); i++) {
                    node.setAttribute(attributeName, attributeValue);
                }
            }
        },

        _addTemplateObjectsToOwner: {
            value: function(template, owner) {
                var self = this;

                return template.instantiate(owner)
                .then(function(objects) {
                    self._updateScope(owner, objects);
                });
            }
        },

        /**
         * @param how string 'before', 'after', 'append'
         */
        _addTemplateToElement: {
            value: function(template, anchor, how, owner, label) {
                var self = this;

                return template.instantiateIntoDocument(anchor, how, owner)
                    .then(function(result) {
                        self._updateScope(owner, result.objects, anchor);
                        if (label !== "owner") {
                            self._updateLiveEditAttributes(anchor,
                                result.firstElement, result.lastElement, owner,
                                label);
                        }
                    });
            }
        },

        /**
         * When objects are added to a live application they need to be added to
         * the owner's templateObjects and documentPart.
         * Also, if components were added to a repetition's iteration then they
         * also need to be added to the iteration's documentPart.
         */
        _updateScope: {
            value: function(owner, objects, node) {
                var object,
                    ownerDocumentPart = owner._templateDocumentPart,
                    ownerModuleId,
                    iteration;

                if (node) {
                    //jshint -W106
                    ownerModuleId = owner._montage_metadata.moduleId;
                    //jshint +W106

                    if (this._isNodePartOfIteration(ownerModuleId, node)) {
                        iteration = this.findIterationContainingNode(node);
                    }
                }

                for (var key in objects) {
                    object = objects[key];
                    // these components are actually created by a repetition
                    if (object.element && iteration) {
                        this._updateIteration(iteration, object);
                    }

                    ownerDocumentPart.objects[key] = objects[key];
                }
                owner._addTemplateObjects(objects);
            }
        },

        /**
         * Updates all iteration related state when a new component is added to
         * it. This includes the DocumentPart, template metadata and other
         * internal state of the iteration.
         */
        _updateIteration: {
            value: function(iteration, component) {
                var iterationDocumentPart = iteration._templateDocumentPart;
                var objects = iterationDocumentPart.objects;
                var template = iterationDocumentPart.template;
                //jshint -W106
                var componentLabel = component._montage_metadata.label;
                //jshint +W106
                var label = componentLabel;
                var repetition = iteration.repetition;
                var element = component.element;

                if (label in objects) {
                    //jshint -W106
                    label = component.ownerComponent._montage_metadata.moduleId +
                        "," + label;
                    //jshint +W106
                }

                objects[label] = component;
                template.setObjectMetadata(label, null, componentLabel,
                    component.ownerComponent);
                if (repetition.element === element.parentNode) {
                    repetition._iterationForElement.set(element, iteration);
                }
            }
        },

        _updateLiveEditAttributes: {
            value: function(anchor, firstElement, lastElement, owner, label) {
                var leArgRangeValue = owner._montage_metadata.moduleId + "," + label;
                var nextSibling = lastElement.nextElementSibling;
                var previousSibling = firstElement.previousElementSibling;

                if (nextSibling === anchor) {
                    this._updateLiveEditRangeAttributes(ATTR_LE_ARG_BEGIN,
                        leArgRangeValue, firstElement, anchor);
                } else if (previousSibling === anchor) {
                    this._updateLiveEditRangeAttributes(ATTR_LE_ARG_END,
                        leArgRangeValue, lastElement, anchor);
                }
            }
        },

        /**
         * The new content needs to be tagged with the argument range attributes
         * if it expanded the argument from the sides. This means that it is
         * now the new firstElement or the new lastElement of the star argument.
         */
        _updateLiveEditRangeAttributes: {
            value: function(fringeAttrName, fringeAttrValue, newFringe, currentFringe) {
                var leArgValue = currentFringe.getAttribute(fringeAttrName);

                if (leArgValue) {
                    var values = leArgValue.trim().split(/\s+/);
                    var ix = values.indexOf(fringeAttrValue);
                    if (ix >= 0) {
                        values.splice(ix, 1);
                        if (values.length === 0) {
                            currentFringe.removeAttribute(fringeAttrName);
                        } else {
                            currentFringe.setAttribute(fringeAttrName,
                                values.join(" "));
                        }
                        newFringe.setAttribute(fringeAttrName, fringeAttrValue);
                    }
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
            documentPart,
            ownerModuleId;

        element = document.createElement("div");
        element.innerHTML = this.html;
        this._addElement(element, anchor, how);

        //jshint -W106
        ownerModuleId = owner._montage_metadata.moduleId;
        //jshint +W106
        // The new elements will be part of the same DocumentPart as the anchor
        // node.
        documentPart = LiveEdit.findNodeDocumentPart(ownerModuleId, anchor);

        if (this.serializationString) {
            return this.instantiate(owner, element, documentPart)
                .then(function(objects) {
                    var result = {
                        objects: objects
                    };

                    result.firstElement = element.firstElementChild;
                    result.lastElement = element.lastElementChild;
                    self._removeElementWrapper(element);

                    for (var key in objects) {
                        if (objects[key].loadComponentTree) {
                            objects[key].loadComponentTree();
                        }
                    }

                    return result;
                });
        } else {
            return Declarativ.Promise.resolve();
        }
    };

    Template.prototype.instantiate = function(owner, element, documentPart) {
        var self = this;
        var deserializer = new Declarativ.Deserializer();

        deserializer.init(this.serializationString, require);
        return deserializer.deserialize({owner: owner}, element)
            .then(function(objects) {
                self._invokeDelegates(owner, objects, documentPart);
                return objects;
            });
    };

    Template.prototype.removeComponentElementReferences = function() {
        var serialization = JSON.parse(this.serializationString);

        for (var key in serialization) {
            var object = serialization[key];
            if (object.properties && object.properties.element) {
                delete object.properties.element;
            }
        }

        this.serializationString = JSON.stringify(serialization);
    };

    Template.prototype._invokeDelegates = function(owner, objects, documentPart) {
        if (!documentPart) {
            documentPart = owner._templateDocumentPart;
        }

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