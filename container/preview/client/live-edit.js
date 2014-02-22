/*global window, montageRequire, document, XPathResult, Declarativ */
window.MONTAGE_LE_FLAG = true;
if (typeof window.Declarativ === "undefined") {
    window.Declarativ = {};
}

Object.defineProperties(window.Declarativ, {
    _Montage: {
        value: null,
        writable: true
    },

    Montage: {
        get: function() {
            if (!this._Montage) {
                this._Montage = montageRequire("core/core").Montage;
            }

            return this._Montage;
        }
    },

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
                    //jshint -W106
                    if (node.component && node.component._montage_metadata.moduleId === moduleId) {
                        return node.component;
                    }
                    //jshint +W106
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
                var montageObjects = MontageObject.findAll(ownerModuleId, label);
                var object;

                for (var i = 0, montageObject; (montageObject = montageObjects[i]); i++) {
                    object = montageObject.value;
                    for (var key in properties) {
                        if (properties.hasOwnProperty(key)) {
                            object[key] = properties[key];
                        }
                    }
                }
            }
        },

        setObjectProperty: {
            value: function(ownerModuleId, label, propertyName, propertyValue, propertyType) {
                if (propertyType === "element") {
                    return this._setObjectPropertyWithElement(ownerModuleId,
                        label, propertyName, propertyValue);
                } else if (propertyType === "object") {
                    return this._setObjectPropertyWithObject(ownerModuleId,
                        label, propertyName, propertyValue.label);
                } else {
                    var montageObjects = MontageObject.findAll(ownerModuleId, label);

                    for (var i = 0, montageObject; (montageObject = montageObjects[i]); i++) {
                        montageObject.value[propertyName] = propertyValue;
                    }
                }
            }
        },

        /**
         * We need to set the elements this way because otherwise we need to
         * perform a querySelector from the owner element and that could return
         * us the wrong elements in the case of self nested components.
         * We might also need to clone the object if the node is part of a
         * repetition and the property is the component's element.
         */
        _setObjectPropertyWithElement: {
            value: function(ownerModuleId, label, propertyName, elementValue) {
                var nodes,
                    documentPart,
                    promises = [];

                nodes = this.findNodes(ownerModuleId, elementValue.label,
                    elementValue.argumentName, elementValue.cssSelector);

                for (var i = 0, node; (node = nodes[i]); i++) {
                    if (propertyName === "element") {
                        promises.push(
                            this._updateComponentElement(ownerModuleId, label, node)
                        );
                    } else {
                        documentPart = this.findNodeDocumentPart(ownerModuleId, node);
                        // TODO: will not work if the object is inside a
                        // repetition and is an argument with a clashed name.
                        if (label in documentPart.objects) {
                            documentPart.objects[label][propertyName] = node;
                        }
                    }
                }

                return Declarativ.Promise.all(promises);
            }
        },

        _updateComponentElement: {
            value: function(ownerModuleId, label, node) {
                var self = this;
                var documentPart = this.findNodeDocumentPart(ownerModuleId, node);
                var owner = this._findParentComponentWithModuleId(
                    node, ownerModuleId);
                var template;

                // The documentPart of the node is the DocumentPart of the
                // template scope where the node was instantiated, if this
                // doesn't match the DocumentPart of the owner  it means
                // this particular node was not instantiated in the scope
                // of the owner's template but rather in the context of an
                // iteration template.
                if (owner._templateDocumentPart === documentPart) {
                    self._setComponentElement(documentPart.objects[label], node);
                } else {
                    // This exact operation (creating the template) might happen
                    // several times if the nodes are in a repetition....
                    // Should try to optimize this somehow.
                    template = this._createTemplateWithObject(owner._template, label);
                    template.removeComponentElementReferences();
                    return template.instantiate(owner, node)
                        .then(function(objects) {
                            self._updateScope(owner, objects, node);
                            self._setComponentElement(objects[label], node);
                        });
                }
            }
        },

        _setComponentElement: {
            value: function(component, element) {
                component.element = element;
                component.attachToParentComponent();
                component.loadComponentTree();
            }
        },

        _setObjectPropertyWithObject: {
            value: function(ownerModuleId, label, propertyName, objectLabel) {
                var montageObjects,
                    object;

                montageObjects = MontageObject.findAll(ownerModuleId, label);

                for (var i = 0, montageObject; (montageObject = montageObjects[i]); i++) {
                    object = this._lookupObjectInScope(montageObject.documentPart,
                        objectLabel, montageObject.owner);
                    montageObject.value[propertyName] = object;
                }
            }
        },

        _createTemplateWithObject: {
            value: function(template, label) {
                var sourceSerialization = template.getSerialization().getSerializationObject();
                var destinationSerialization = {};
                var object = sourceSerialization[label];
                var montageId;
                var html;

                destinationSerialization[label] = object;
                if (object.properties && object.properties.element) {
                    montageId = object.properties.element["#"];
                    html = template.getElementById(montageId).outerHTML;
                    html = "<html><body>" + html + "</body></html>";
                }

                return new Template(JSON.stringify(destinationSerialization), html);
            }
        },

        setObjectBinding: {
            value: function(ownerModuleId, label, binding) {
                var montageObjects = MontageObject.findAll(ownerModuleId, label);

                for (var i = 0, montageObject; (montageObject = montageObjects[i]); i++) {
                    montageObject.defineBinding(binding.propertyName,
                        binding.propertyDescriptor);
                }
            }
        },

        deleteObjectBinding: {
            value: function(ownerModuleId, label, path) {
                var montageObjects = MontageObject.findAll(ownerModuleId, label);

                for (var i = 0, montageObject; (montageObject = montageObjects[i]); i++) {
                    montageObject.cancelBinding(path);
                }
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
                var montageObjects = MontageObject.findAll(moduleId, "owner");

                var template = new Template(templateFragment.serialization);
                var promises = [];

                template.removeComponentElementReferences();
                for (var i = 0, montageObject; (montageObject = montageObjects[i]); i++) {
                    promises.push(
                        this._addTemplateObjectsToOwner(template,
                            montageObject.value)
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

        setObjectTemplate: {
            value: function(moduleId, templateFragment) {
                var montageObjects = MontageObject.findAll(moduleId, "owner");

                for (var i = 0, montageObject; (montageObject = montageObjects[i]); i++) {
                    montageObject.setTemplate(templateFragment);
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

                if (iteration) {
                    this._updateIterationElements(iteration);
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
                    var firstDraw = function() {
                        component.removeEventListener("firstDraw", firstDraw, false);
                        repetition._iterationForElement.set(component.element, iteration);
                    };
                    component.addEventListener("firstDraw", firstDraw, false);
                }
            }
        },

        _updateIterationElements: {
            value: function(iteration) {
                var repetition = iteration.repetition;
                var index = iteration._drawnIndex;

                // Check to see if new elements were added to the bottom
                // boundary and move the text comment boundary if that's the
                // case. This only happens to the bottom boundary because new
                // elements at the start of the iteration are added with
                // insertBefore.
                var bottomBoundary = repetition._boundaries[index+1];
                var nextBoundary = repetition._boundaries[index+2];

                if (bottomBoundary.nextSibling != nextBoundary) {
                    var newBoundaryNextSibling = bottomBoundary;
                    do {
                        newBoundaryNextSibling = newBoundaryNextSibling.nextSibling;
                    } while (newBoundaryNextSibling != nextBoundary);
                    bottomBoundary.parentNode.insertBefore(bottomBoundary, newBoundaryNextSibling);
                }

                repetition._iterationForElement.clear();
                iteration.forEachElement(function (element) {
                    repetition._iterationForElement.set(element, iteration);
                });
            }
        },

        _updateLiveEditAttributes: {
            value: function(anchor, firstElement, lastElement, owner, label) {
                //jshint -W106
                var leArgRangeValue = owner._montage_metadata.moduleId + "," + label;
                //jshint +W106
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
        },

        addObjectEventListener: {
            value: function(ownerModuleId, label, type, listenerLabel, useCapture) {
                var montageObjects = MontageObject.findAll(ownerModuleId, label);

                for (var i = 0, montageObject; (montageObject = montageObjects[i]); i++) {
                    this._addEventListener(montageObject.value, type,
                        listenerLabel, useCapture);
                }
            }
        },

        removeObjectEventListener: {
            value: function(ownerModuleId, label, type, listenerLabel, useCapture) {
                var montageObjects = MontageObject.findAll(ownerModuleId, label);

                for (var i = 0, montageObject; (montageObject = montageObjects[i]); i++) {
                    this._removeEventListener(montageObject.value, type,
                        listenerLabel, useCapture);
                }
            }
        },

        _addEventListener: {
            value: function(object, type, listenerLabel, useCapture) {
                var owner = object.ownerComponent;
                var ownerDocumentPart = object._ownerDocumentPart;

                var listener = this._lookupObjectInScope(ownerDocumentPart,
                    listenerLabel, owner);
                object.addEventListener(type, listener, useCapture);
            }
        },

        _removeEventListener: {
            value: function(object, type, listenerLabel, useCapture) {
                var owner = object.ownerComponent;
                var ownerDocumentPart = object._ownerDocumentPart;

                var listener = this._lookupObjectInScope(ownerDocumentPart,
                    listenerLabel, owner);
                object.removeEventListener(type, listener, useCapture);
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
            ownerModuleId,
            result;

        element = document.createElement("div");
        element.innerHTML = this.html;
        this._addElement(element, anchor, how);
        result = {
            firstElement: element.firstElementChild,
            lastElement: element.lastElementChild
        };

        //jshint -W106
        ownerModuleId = owner._montage_metadata.moduleId;
        //jshint +W106
        // The new elements will be part of the same DocumentPart as the anchor
        // node.
        documentPart = LiveEdit.findNodeDocumentPart(ownerModuleId, anchor);

        if (this.serializationString) {
            return this.instantiate(owner, element, documentPart)
                .then(function(objects) {
                    result.objects = objects;
                    self._removeElementWrapper(element);

                    for (var key in objects) {
                        if (objects[key].loadComponentTree) {
                            objects[key].loadComponentTree();
                        }
                    }

                    return result;
                });
        } else {
            return Declarativ.Promise.resolve(result);
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

    function MontageObject(value, label, owner, documentPart) {
        this.value = value;
        this.label = label;
        this.owner = owner;
        this.documentPart = documentPart;
    }

    MontageObject.prototype.defineBinding = function(path, bindingDescriptor) {
        var object = this.value;
        var documentPart = this.documentPart;
        var owner = this.owner;

        if (object.getBinding(path)) {
            object.cancelBinding(path);
        }

        bindingDescriptor.components = {
            getObjectByLabel: function(label) {
                return LiveEdit._getObjectForBinding(owner,
                    documentPart, label);
            }
        };
        object.defineBinding(path, bindingDescriptor);
    };

    MontageObject.prototype.cancelBinding = function(path) {
        if (this.value.getBinding(path)) {
            this.value.cancelBinding(path);
        }
    };

    MontageObject.prototype.setTemplate = function(templateFragment) {
        var template = this.value._template;

        template.objectsString = templateFragment.serialization;
        template.document = template.createHtmlDocumentWithHtml(
            templateFragment.html);
    };

    MontageObject.findAll = function(ownerModuleId, label) {
        if (label === "owner") {
            return this.findAllByModuleId(ownerModuleId);
        } else {
            return this.findAllByLabel(label, ownerModuleId);
        }
    };

    MontageObject.findAllByModuleId = function(moduleId) {
        var montageObjects = [];
        var findObjects = function(component) {
            var childComponents = component.childComponents;
            var childComponent;
            var objects;
            var object;
            var info;

            // Non-components will only be available in the document part.
            if (component._templateDocumentPart) {
                objects = component._templateDocumentPart.objects;
                for (var label in objects) {
                    object = objects[label];
                    if (!object.childComponents) {
                        info = Declarativ.Montage.getInfoForObject(object);
                        if (info.moduleId === moduleId) {
                            montageObjects.push(
                                new MontageObject(object, label, component, component._templateDocumentPart));
                        }
                    }
                }
            }

            for (var i = 0; (childComponent = childComponents[i]); i++) {
                //jshint -W106
                if (childComponent._montage_metadata.moduleId === moduleId) {
                    montageObjects.push(
                        new MontageObject(childComponent,
                            childComponent._montage_metadata.label, component,
                            childComponent._ownerDocumentPart));
                }
                //jshint +W106
                findObjects(childComponent);
            }
        };

        findObjects(LiveEdit.rootComponent);
        return montageObjects;
    };

    MontageObject.findAllByLabel = function(label, ownerModuleId) {
        var montageObjects = [];
        var findObjects = function(component) {
            var childComponents = component.childComponents;
            var childComponent;
            var objects;
            var object;

            // Non-components will only be available in the document part.
            if (component._templateDocumentPart) {
                objects = component._templateDocumentPart.objects;
                object = objects[label];
                if (object && !object.childComponents) {
                    montageObjects.push(
                        new MontageObject(object, label, component,
                            component._templateDocumentPart));
                }
            }

            for (var i = 0; (childComponent = childComponents[i]); i++) {
                //jshint -W106
                if (childComponent._montage_metadata.label === label &&
                    childComponent.ownerComponent._montage_metadata.moduleId === ownerModuleId) {
                    montageObjects.push(
                        new MontageObject(childComponent,
                            childComponent._montage_metadata.label, component,
                            childComponent._ownerDocumentPart));
                }
                //jshint +W106
                findObjects(childComponent);
            }
        };

        findObjects(LiveEdit.rootComponent);
        return montageObjects;
    };

})(window.Declarativ);