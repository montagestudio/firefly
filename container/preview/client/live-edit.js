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

    ns.LiveEdit = Object.create(Object.prototype, {
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
         * We might also need to clone the object if the element is part of a
         * repetition and the property is the component's element.
         */
        _setObjectPropertyWithElement: {
            value: function(ownerModuleId, label, propertyName, elementValue) {
                var montageElements,
                    object,
                    montageComponent,
                    promises = [];

                montageElements = MontageElement.findAll(ownerModuleId,
                    elementValue.label, elementValue.argumentName,
                    elementValue.cssSelector);

                for (var i = 0, montageElement; montageElement = montageElements[i]; i++) {
                    // TODO: should look this object in the scope. Could be
                    // setting an object that already has an element and is
                    // inside a repetition.
                    object = montageElement.owner._templateDocumentPart.objects[label];
                    if (propertyName === "element" && object.childComponents) {
                        montageComponent = new MontageComponent(object, label);
                        promises.push(
                            montageComponent.setElement(montageElement)
                        );
                    } else {
                        // Will not work if the object is inside a
                        // repetition and is an argument with a clashed name.
                        // Not an issue at the moment, could be in the future
                        // when we add support to put non-components into the
                        // repetition iteration template.
                        if (object) {
                            object[propertyName] = montageElement.value;
                        }
                    }
                }

                return Declarativ.Promise.all(promises);
            }
        },

        _setObjectPropertyWithObject: {
            value: function(ownerModuleId, label, propertyName, objectLabel) {
                var montageObjects,
                    object;

                montageObjects = MontageObject.findAll(ownerModuleId, label);

                for (var i = 0, montageObject; (montageObject = montageObjects[i]); i++) {
                    object = montageObject.scope.lookupObject(objectLabel,
                        montageObject.owner);
                    montageObject.value[propertyName] = object;
                }
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

                // TODO: since the repetition has elements that are not in the
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
                    ownerDocumentPart;

                // If the label is the owner then we don't need to search for it.
                if (label === "owner") {
                    return owner;
                }

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
                    // owner objects need to keep the owner label.
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
            value: function(ownerModuleId, label, argumentName, cssSelector, how, templateFragment) {
                var montageElements = MontageElement.findAll(ownerModuleId,
                    label, argumentName, cssSelector);
                var template = new Template(templateFragment.serialization,
                    templateFragment.html);
                var promises = [];

                for (var i = 0, montageElement; montageElement = montageElements[i]; i++) {
                    promises.push(
                        montageElement.addTemplate(template, how)
                    );
                }

                return Declarativ.Promise.all(promises);
            }
        },

        addTemplateFragmentObjects: {
            value: function(ownerModuleId, templateFragment) {
                var montageComponents = MontageComponent.findAll(ownerModuleId);

                var template = new Template(templateFragment.serialization);
                var promises = [];

                template.removeComponentElementReferences();
                for (var i = 0, montageComponent; (montageComponent = montageComponents[i]); i++) {
                    promises.push(
                        montageComponent.addTemplateObjects(template)
                    );
                }

                return Declarativ.Promise.all(promises);
            }
        },

        setElementAttribute: {
            value: function(ownerModuleId, label, argumentName, cssSelector, attributeName, attributeValue) {
                var montageElements = MontageElement.findAll(ownerModuleId,
                    label, argumentName, cssSelector);

                for (var i = 0, montageElement; montageElement = montageElements[i]; i++) {
                    montageElement.value.setAttribute(attributeName,
                        attributeValue);
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

        /**
         * When objects are added to a live application they need to be added to
         * the owner's templateObjects and documentPart.
         * Also, if components were added to a repetition's iteration then they
         * also need to be added to the iteration's documentPart.
         * The montageElement when given is used to update an iteration scope
         * if the montageElement is created by an iteration.
         */
        _updateScope: {
            value: function(owner, objects, montageElement) {
                var object,
                    ownerDocumentPart = owner._templateDocumentPart,
                    iteration;

                if (montageElement) {
                    iteration = montageElement.iteration;
                }

                for (var key in objects) {
                    object = objects[key];
                    // These components were created by a repetition
                    if (object.element && iteration) {
                        this._updateIteration(iteration, object);
                    }

                    ownerDocumentPart.objects[key] = objects[key];
                }

                if (iteration) {
                    this._updateIterationElements(iteration);
                }

                // TODO: Should we update the owner template objects if the
                // scope was an iteration?
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

        addObjectEventListener: {
            value: function(ownerModuleId, label, type, listenerLabel, useCapture) {
                var montageObjects = MontageObject.findAll(ownerModuleId, label);

                for (var i = 0, montageObject; (montageObject = montageObjects[i]); i++) {
                    montageObject.addEventListener(type, listenerLabel,
                        useCapture);
                }
            }
        },

        removeObjectEventListener: {
            value: function(ownerModuleId, label, type, listenerLabel, useCapture) {
                var montageObjects = MontageObject.findAll(ownerModuleId, label);

                for (var i = 0, montageObject; (montageObject = montageObjects[i]); i++) {
                    montageObject.removeEventListener(type, listenerLabel,
                        useCapture);
                }
            }
        }
    });

    function Template(serializationString, html) {
        this.html = html;
        this.serializationString = serializationString;
    }

    Template.prototype.instantiateIntoDocument = function(anchor, how) {
        var self = this,
            element,
            documentPart,
            result,
            owner;

        element = document.createElement("div");
        element.innerHTML = this.html;
        this._addElement(element, anchor, how);
        result = {
            firstElement: element.firstElementChild,
            lastElement: element.lastElementChild
        };

        owner = anchor.owner;
        // The new elements will be part of the same DocumentPart as the anchor
        // element.
        documentPart = anchor.documentPart;

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
        var anchorElement = anchor.value;

        if (how === "before") {
            anchorElement.parentNode.insertBefore(element, anchorElement);
        } else if (how === "after") {
            anchorElement.parentNode.insertBefore(element,
                anchorElement.nextSibling);
        } else if (how === "append") {
            anchorElement.appendChild(element);
        }
    };

    Template.prototype._removeElementWrapper = function(element) {
        var range = Template._range;

        range.selectNodeContents(element);
        element.parentNode.insertBefore(range.extractContents(), element);
        element.parentNode.removeChild(element);
    };

    Template._range = document.createRange();

    Template.createTemplateWithObject = function(template, label) {
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
    };

    /// MONTAGE OBJECT

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

    MontageObject.prototype.addEventListener = function(type, listenerLabel, useCapture) {
        var listener = LiveEdit._lookupObjectInScope(this.documentPart,
            listenerLabel, this.owner);
        this.value.addEventListener(type, listener, useCapture);
    };

    MontageObject.prototype.removeEventListener = function(type, listenerLabel, useCapture) {
        var listener = LiveEdit._lookupObjectInScope(this.documentPart,
            listenerLabel, this.owner);
        this.value.removeEventListener(type, listener, useCapture);
    };

    MontageObject.findAll = function(ownerModuleId, label) {
        if (label === "owner") {
            return MontageComponent.findAll(ownerModuleId);
        } else {
            return this.findAllByLabel(ownerModuleId, label);
        }
    };

    MontageObject.findAllByLabel = function(ownerModuleId, label) {
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
                    montageObjects.push(new MontageComponent(childComponent, label));
                }
                //jshint +W106
                findObjects(childComponent);
            }
        };

        findObjects(MontageComponent.rootComponent);
        return montageObjects;
    };

    /// MONTAGE COMPONENT

    function MontageComponent(value, label) {
        this.value = value;
        //jshint -W106
        this.label = label;
        //jshint +W106
        this.owner = value.ownerComponent;
        if (label === "owner") {
            this.documentPart = value._templateDocumentPart;
        } else {
            this.documentPart = value._ownerDocumentPart;
        }
    }

    MontageComponent.prototype = Object.create(MontageObject.prototype);
    MontageComponent.prototype.constructor = MontageComponent;

    MontageComponent.findAll = function(moduleId) {
        var montageComponents = [];
        var findObjects = function(component) {
            var childComponents = component.childComponents;
            var childComponent;

            for (var i = 0; (childComponent = childComponents[i]); i++) {
                //jshint -W106
                if (childComponent._montage_metadata.moduleId === moduleId) {
                    montageComponents.push(new MontageComponent(childComponent, "owner"));
                }
                //jshint +W106
                findObjects(childComponent);
            }
        };

        findObjects(MontageComponent.rootComponent);
        return montageComponents;
    };

    /**
     * Instantiates the template and adds all objects to the component's
     * template
     */
    MontageComponent.prototype.addTemplateObjects = function(template) {
        var owner = this.value;

        return template.instantiate(owner)
            .then(function(objects) {
                LiveEdit._updateScope(owner, objects);
            });
    };

    MontageComponent.prototype.setElement = function(montageElement) {
        var documentPart = montageElement.documentPart;
        var element = montageElement.value;
        var owner = this.owner;
        var label = this.label;
        var template;

        // The documentPart of the element is the DocumentPart of the
        // template scope where the element was instantiated, if this
        // doesn't match the DocumentPart of the owner  it means
        // this particular element was not instantiated in the scope
        // of the owner's template but rather in the context of an
        // iteration template.
        // TODO: use .iteration
        if (owner._templateDocumentPart === documentPart) {
            MontageComponent._setComponentElement(documentPart.objects[label], element);
        } else {
            // This exact operation (creating the template) might happen
            // several times if the elements are in a repetition....
            // Should try to optimize this somehow.
            template = Template.createTemplateWithObject(owner._template, label);
            template.removeComponentElementReferences();
            return template.instantiate(owner, element)
                .then(function(objects) {
                    MontageComponent._setComponentElement(objects[label], element);
                    LiveEdit._updateScope(owner, objects, montageElement);
                });
        }
    };

    MontageComponent.prototype.setTemplate = function(templateFragment) {
        var template = this.value._template;

        template.objectsString = templateFragment.serialization;
        template.document = template.createHtmlDocumentWithHtml(
            templateFragment.html);
    };

    Object.defineProperties(MontageComponent.prototype, {
        _inIteration: {value: null, writable: true},
        inIteration: {
            get: function() {
                if (this._inIteration === null) {
                    // The ownerDocumentPart of a component is the DocumentPart of
                    // the template scope where the component was instantiated, if
                    // this doesn't match the DocumentPart of the owner it means
                    // this it was not instantiated in the scope of the owner's
                    // template but rather in the context of an iteration template.
                    this._inIteration = this.documentPart !== this.owner._templateDocumentPart;
                }

                return this._inIteration;
            }
        }
    });

    Object.defineProperties(MontageComponent.prototype, {
        _iteration: {value: false, writable: true},
        iteration: {
            get: function() {
                if (this._iteration === false) {
                    var component = this.value;

                    this._iteration = null;
                    while (component = /* assignment */ component.parentComponent) {
                        if (component.clonesChildComponents) {
                            this._iteration = component._findIterationContainingElement(component.element);
                        }
                    }
                }

                return this._iteration;
            }
        }
    });

    MontageComponent._setComponentElement = function(component, element) {
        component.element = element;
        component.attachToParentComponent();
        component.loadComponentTree();
    };

    MontageComponent._isComponentPartOfIteration = function(component) {
        // The ownerDocumentPart of a component is the DocumentPart of
        // the template scope where the component was instantiated, if
        // this doesn't match the DocumentPart of the owner it means
        // this it was not instantiated in the scope of the owner's
        // template but rather in the context of an iteration template.
        return component._ownerDocumentPart !== component.ownerComponent._templateDocumentPart;
    };

    MontageComponent._getComponentIteration = function(component) {
        //jshint -W106
        while (component = /* assignment */ component.parentComponent) {
            if (component.clonesChildComponents) {
                return component._findIterationContainingElement(component.element);
            }
        }
        //jshint +W106
    };

    Object.defineProperties(MontageComponent, {
        _rootComponent: {value: null, writable: true},
        rootComponent: {
            get: function() {
                if (!this._rootComponent) {
                    //jshint -W106
                    this._rootComponent = montageRequire("ui/component").__root__;
                    //jshint +W106
                }
                return this._rootComponent;
            }
        }
    });

    /// MONTAGE ELEMENT

    function MontageElement(value, ownerModuleId, label, argumentName, cssSelector) {
        this.value = value;
        this.ownerModuleId = ownerModuleId;
        this.label = label;
        this.argumentName = argumentName;
        this.cssSelector = cssSelector;
    }

    MontageElement.findAll = function(ownerModuleId, label, argumentName, cssSelector) {
        var moduleIdSelector;
        var elements;
        var montageElements = [];

        if (label === "owner") {
            moduleIdSelector = "*[" + ATTR_LE_COMPONENT + "='" + ownerModuleId + "']";
        } else if (argumentName) {
            moduleIdSelector = "*[" + ATTR_LE_ARG + "='" + ownerModuleId + "," + label + "," + argumentName + "']";
        } else {
            moduleIdSelector = "*[" + ATTR_LE_ARG_BEGIN + "~='" + ownerModuleId + "," + label + "']";
        }

        cssSelector = cssSelector.replace(":scope", moduleIdSelector);
        elements = document.querySelectorAll(cssSelector);

        for (var i = 0, element; element = elements[i]; i++) {
            montageElements.push(
                new MontageElement(element, ownerModuleId, label, argumentName,
                    cssSelector)
            );
        }

        return montageElements;
    };

    /**
     * Instantiates and adds the template using this element as an anchor point.
     * @param template Template The template to add.
     * @param how string How to add: "before", "after" or "append" to this node.
     */
    MontageElement.prototype.addTemplate = function(template, how) {
        var self = this;
        var owner = this.owner;

        return template.instantiateIntoDocument(this, how)
            .then(function(result) {
                LiveEdit._updateScope(owner, result.objects, self);
                if (self.label !== "owner") {
                    self.updateLiveEditAttributes(result.firstElement,
                        result.lastElement);
                }
            });
    };

    Object.defineProperties(MontageElement.prototype, {
        _owner: {value: false, writable: true},
        owner: {
            get: function() {
                if (this._owner === false) {
                    var element = this.value;
                    var ownerModuleId = this.ownerModuleId;
                    var matchComponent = function(component) {
                        //jshint -W106
                        return component &&
                            component._montage_metadata.moduleId === ownerModuleId;
                        //jshint +W106
                    };

                    this._owner = null;
                    if (this.label === "owner" &&
                        matchComponent(element.component)) {
                        this._owner = element.component;
                    } else {
                        while (element = /*assignment*/ element.parentNode) {
                            if (matchComponent(element.component)) {
                                this._owner = element.component;
                                break;
                            }
                        }
                    }
                }

                return this._owner;
            }
        }
    });

    Object.defineProperties(MontageElement.prototype, {
        _documentPart: {value: false, writable: true},
        documentPart: {
            get: function() {
                if (this._documentPart === false) {
                    var component = this.parentComponent,
                        ownerModuleId = this.ownerModuleId,
                        iteration;

                    //jshint -W106
                    // Go up the scope tree up till the owner to check if the
                    // element was created by an iteration.
                    while (component._montage_metadata.moduleId !== ownerModuleId) {
                        if (component.clonesChildComponents) {
                            iteration = component._findIterationContainingElement(this.value);
                            this._documentPart = iteration._templateDocumentPart;
                            break;
                        } else if (MontageComponent._isComponentPartOfIteration(component)) {
                            this._documentPart = component._ownerDocumentPart;
                            break;
                        }
                        component = component.ownerComponent;
                    }
                    //jshint +W106

                    // If the element was not created by an iteration then the
                    // previous block stopped at the owner.
                    if (!this._documentPart) {
                        this._documentPart = component._templateDocumentPart;
                        this._owner = component;
                    }
                }

                return this._documentPart;
            }
        }
    });

    Object.defineProperties(MontageElement.prototype, {
        _parentComponent: {value: false, writable: true},
        parentComponent: {
            get: function() {
                if (this._parentComponent === false) {
                    var element = this.value;

                    this._parentComponent = null;
                    if (this.label === "owner" && element.component) {
                        this._parentComponent = element.component;
                    } else {
                        while (element = /*assignment*/ element.parentNode) {
                            if (element.component) {
                                this._parentComponent = element.component;
                                break;
                            }
                        }
                    }
                }

                return this._parentComponent;
            }
        }
    });

    Object.defineProperties(MontageElement.prototype, {
        _iteration: {value: false, writable: true},
        iteration: {
            get: function() {
                if (this._iteration === false) {
                    var ownerModuleId = this.ownerModuleId;
                    var component = this.parentComponent;

                    this._iteration = null;
                    //jshint -W106
                    while (component._montage_metadata.moduleId !== ownerModuleId) {
                        if (component.clonesChildComponents) {
                            this._iteration = component._findIterationContainingElement(this.value);
                            break;
                        } else if (MontageComponent._isComponentPartOfIteration(component)) {
                            this._iteration = MontageComponent._getComponentIteration(component);
                            break;
                        }
                        component = component.ownerComponent;
                    }
                    //jshint +W106
                }

                return this._iteration;
            }
        }
    });

    /**
     * Update the Live Edit attributes this element might have, this will happen
     * when this element gains new siblings. The new siblings might take away
     * the arg-begin or arg-end that the element might have.
     * This is the case when this element is the beginning or the end of a DOM
     * argument star range.
     */
    MontageElement.prototype.updateLiveEditAttributes = function(siblingFirstElement, siblingLastElement) {
        var element = this.value;
        //jshint -W106
        var leArgRangeValue = this.owner._montage_metadata.moduleId + "," +
            this.label;
        //jshint +W106
        var nextSibling = siblingLastElement.nextElementSibling;
        var previousSibling = siblingFirstElement.previousElementSibling;

        if (nextSibling === element) {
            this._updateLiveEditRangeAttributes(ATTR_LE_ARG_BEGIN,
                leArgRangeValue, siblingFirstElement);
        } else if (previousSibling === element) {
            this._updateLiveEditRangeAttributes(ATTR_LE_ARG_END,
                leArgRangeValue, siblingLastElement);
        }
    };

    /**
     * The new content needs to be tagged with the argument range attributes
     * if it expanded the argument from the sides. This means that it is
     * now the new firstElement or the new lastElement of the star argument.
     */
    MontageElement.prototype._updateLiveEditRangeAttributes = function(fringeAttrName, fringeAttrValue, newFringe) {
        var element = this.value;
        var leArgValue = element.getAttribute(fringeAttrName);

        if (leArgValue) {
            var values = leArgValue.trim().split(/\s+/);
            var ix = values.indexOf(fringeAttrValue);
            if (ix >= 0) {
                values.splice(ix, 1);
                if (values.length === 0) {
                    element.removeAttribute(fringeAttrName);
                } else {
                    element.setAttribute(fringeAttrName,
                        values.join(" "));
                }
                newFringe.setAttribute(fringeAttrName, fringeAttrValue);
            }
        }
    };
})(window.Declarativ);