/*global window, montageRequire, document, Declarativ */
//jshint -W106
//jshint -W089
Object.defineProperty(window, "_montage_le_flag", { value: true });
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

//jshint -W030
(function(ns) {
    var ATTR_ARG = "data-arg";
    var ATTR_MONTAGE_ID = "data-montage-id";

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

        setObjectLabel: {
            value: function(ownerModuleId, label, newLabel) {
                var montageObjects = MontageObject.findAll(ownerModuleId, label);
                var montageObject;

                for (var i = 0; (montageObject = montageObjects[i]); i++) {
                    montageObject.setLabel(newLabel);
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

        addTemplateFragment: {
            value: function(ownerModuleId, elementLocation, how, templateFragment) {
                var promises = [];
                var montageElements;
                var template;
                var montageTemplate;

                // Add to the owner template
                montageTemplate = MontageTemplate.find(ownerModuleId);
                montageTemplate.addTemplateFragment(templateFragment,
                    elementLocation, how);

                // Update the live application
                montageElements = MontageElement.findAll(ownerModuleId,
                    elementLocation.label, elementLocation.argumentName,
                    elementLocation.cssSelector);
                template = new Template(templateFragment.serialization,
                    templateFragment.html);

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
                var montageComponents;
                var template;
                var montageTemplate;
                var promises = [];

                // Add to the owner template
                montageTemplate = MontageTemplate.find(ownerModuleId);
                montageTemplate.addTemplateFragmentObjects(templateFragment);

                // Update the live application
                montageComponents = MontageComponent.findAll(ownerModuleId);
                template = new Template(templateFragment.serialization);
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
            value: function(ownerModuleId, elementLocation, attributeName, attributeValue) {
                var montageElements = MontageElement.findAll(ownerModuleId,
                    elementLocation.label, elementLocation.argumentName, elementLocation.cssSelector);

                for (var i = 0, montageElement; montageElement = montageElements[i]; i++) {
                    montageElement.value.setAttribute(attributeName,
                        attributeValue);
                }
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

        if (this.serializationString) {
            owner = anchor.owner;
            // The new elements will be part of the same DocumentPart as the anchor
            // element.
            documentPart = anchor.documentPart;

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
            this._removeElementWrapper(element);
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
        var object;

        for (var key in serialization) {
            if (serialization.hasOwnProperty(key)) {
                object = serialization[key];
                if (object.properties && object.properties.element) {
                    delete object.properties.element;
                }
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

    MontageObject.prototype.setLabel = function(label) {
        Declarativ.Montage.getInfoForObject(this.value).label = label;
        this.label = label;
    };

    MontageObject.prototype.defineBinding = function(path, bindingDescriptor) {
        var object = this.value;
        var owner = this.owner;
        var scope = this.scope;

        if (object.getBinding(path)) {
            object.cancelBinding(path);
        }

        bindingDescriptor.components = {
            getObjectByLabel: function(label) {
                return scope.lookupObject(label, owner);
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
        var listener = this.scope.lookupObject(listenerLabel, this.owner);
        this.value.addEventListener(type, listener, useCapture);
    };

    MontageObject.prototype.removeEventListener = function(type, listenerLabel, useCapture) {
        var listener = this.scope.lookupObject(listenerLabel, this.owner);
        this.value.removeEventListener(type, listener, useCapture);
    };

    Object.defineProperties(MontageObject.prototype, {
        _scope: {value: false, writable: true},
        scope: {
            get: function() {
                if (this._scope === false) {
                    this._scope = new MontageScope(this.documentPart);
                }

                return this._scope;
            }
        }
    });

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
                if (childComponent._montage_metadata.label === label &&
                    childComponent.ownerComponent._montage_metadata.moduleId === ownerModuleId) {
                    montageObjects.push(new MontageComponent(childComponent, label));
                }
                findObjects(childComponent);
            }
        };

        findObjects(MontageComponent.rootComponent);
        return montageObjects;
    };

    /// MONTAGE COMPONENT

    function MontageComponent(value, label) {
        this.value = value;
        this.label = label;
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
                if (childComponent._montage_metadata.moduleId === moduleId) {
                    montageComponents.push(new MontageComponent(childComponent, "owner"));
                }
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
        var scope = this.scope;
        var owner = this.value;

        return template.instantiate(owner)
            .then(function(objects) {
                scope.addObjects(objects, owner);
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
                    montageElement.scope.addObjects(objects, owner);
                });
        }
    };

    MontageComponent.prototype.setLabel = function(label) {
        var originalLabel = this.label;

        MontageObject.prototype.setLabel.call(this, label);
        if (this.value.identifier === originalLabel) {
            this.value.identifier = label;
        }
        this._updateLiveEditAttributes(originalLabel);
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
        while (component = /* assignment */ component.parentComponent) {
            if (component.clonesChildComponents) {
                return component._findIterationContainingElement(component.element);
            }
        }
    };

    MontageComponent.prototype._updateLiveEditAttributes = function(label) {
        var names = this.value.getDomArgumentNames();

        if (names.length > 0) {
            for (var i = 0, name; name = names[i]; i++) {
                this._updateLiveEditNamedArgumentAttribute(label, name);
            }
        } else {
            this._updateLiveEditStarArgumentAttribute(label);
        }
    };

    MontageComponent.prototype._updateLiveEditStarArgumentAttribute = function(label) {
        var ownerModuleId = this.owner._montage_metadata.moduleId;
        var value = ownerModuleId + "," + label;
        var newValue = ownerModuleId + "," + this.label;

        this._updateLiveEditArgumentAttribute(ATTR_LE_ARG_BEGIN, value, newValue);
        this._updateLiveEditArgumentAttribute(ATTR_LE_ARG_END, value, newValue);
    };

    MontageComponent.prototype._updateLiveEditNamedArgumentAttribute = function(name, label) {
        var ownerModuleId = this.owner._montage_metadata.moduleId;
        var value = ownerModuleId + "," + label + "," + name;
        var newValue = ownerModuleId + "," + this.label + "," + name;

        this._updateLiveEditArgumentAttribute(ATTR_LE_ARG, value, newValue);
    };

    MontageComponent.prototype._updateLiveEditArgumentAttribute = function(attribute, value, newValue) {
        var ownerModuleId = this.owner._montage_metadata.moduleId;
        var cssSelector;
        var elements;
        var montageElement;
        var element;
        var values;
        var ix;

        cssSelector = "*[" + attribute + "~='" + value + "']";
        elements = this.value.element.querySelectorAll(cssSelector);

        // It's possible that this component has more instances of its type
        // down its component tree (e.g.: nested list.reel). When this happens
        // we will also find the arguments for those inner components.
        // Since we want to make sure the elements we update belong to this
        // specific component we need to check the owner of each element found.
        for (var i = 0; element = elements[i]; i++) {
            montageElement = new MontageElement(element, ownerModuleId,
                this.label);

            if (montageElement.owner === this.owner) {
                values = element.getAttribute(attribute).split(/\s+/);
                ix = values.indexOf(value);
                values.splice(ix, 1, newValue);
                element.setAttribute(attribute, values.join(" "));
            }
        }
    };

    Object.defineProperties(MontageComponent, {
        _rootComponent: {value: null, writable: true},
        rootComponent: {
            get: function() {
                if (!this._rootComponent) {
                    this._rootComponent = montageRequire("ui/component").__root__;
                }
                return this._rootComponent;
            }
        }
    });

    /// MONTAGE ELEMENT

    function MontageElement(value, ownerModuleId, label) {
        this.value = value;
        this.ownerModuleId = ownerModuleId;
        this.label = label;
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
                new MontageElement(element, ownerModuleId, label)
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
                self.scope.addObjects(result.objects, owner);
                if (self.label !== "owner") {
                    self.updateLiveEditAttributes(result.firstElement,
                        result.lastElement);
                }
            });
    };

    // We assume that between the element and its owner there is no component
    // with the same module id of the owner.
    // This creates a potential problem for components that include themselves
    // in their template.
    // We'll solve it when we get there.
    Object.defineProperties(MontageElement.prototype, {
        _owner: {value: false, writable: true},
        owner: {
            get: function() {
                if (this._owner === false) {
                    var element = this.value;
                    var ownerModuleId = this.ownerModuleId;
                    var matchComponent = function(component) {
                        return component &&
                            component._montage_metadata.moduleId === ownerModuleId;
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

    // We assume that between the element and its owner there is no component
    // with the same module id of the owner.
    // This creates a potential problem for components that include themselves
    // in their template.
    // We'll solve it when we get there.
    Object.defineProperties(MontageElement.prototype, {
        _documentPart: {value: false, writable: true},
        documentPart: {
            get: function() {
                if (this._documentPart === false) {
                    var component = this.parentComponent,
                        ownerModuleId = this.ownerModuleId,
                        iteration;

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
                    if (this.label === "owner") {
                        this._parentComponent = this.owner;
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
                }

                return this._iteration;
            }
        }
    });

    Object.defineProperties(MontageElement.prototype, {
        _scope: {value: false, writable: true},
        scope: {
            get: function() {
                if (this._scope === false) {
                    this._scope = new MontageScope(this.documentPart);
                }

                return this._scope;
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
        var leArgRangeValue = this.owner._montage_metadata.moduleId + "," +
            this.label;
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

    /// MONTAGE SCOPE

    function MontageScope(documentPart) {
        if (!documentPart) {
            throw new Error("DocumentPart is needed");
        }
        this.documentPart = documentPart;
    }

    MontageScope.prototype.lookupObject = function(label, owner) {
        var templateProperty;

        if (label.indexOf(":") > 0) {
            templateProperty = this.lookupTemplatePropertyLabel(label, owner);
            if (!templateProperty) {
                return;
            }
            label = templateProperty.label;
            owner = templateProperty.owner;
        }

        return this._lookupObject(label, owner);
    };

    MontageScope.prototype._lookupObject = function(label, owner) {
        var object,
            ownerDocumentPart = owner._templateDocumentPart,
            scope = this;

        // If the label is the owner then we don't need to search for it.
        if (label === "owner") {
            return owner;
        }

        do {
            object = scope.getObject(label, owner);
        } while (!object && scope.documentPart !== ownerDocumentPart &&
            (scope = /*assign*/scope.parentScope));

        return object;
    };

    MontageScope.prototype.lookupTemplatePropertyLabel = function(label, owner) {
        var ix = label.indexOf(":");
        var objectLabel = label.substr(0, ix);
        var propertyLabel = label.substr(ix);
        var objectDocumentPart;
        var alias;
        var object;

        object = this._lookupObject(objectLabel, owner);

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
            return this.lookupTemplatePropertyLabel(label, object);
        } else {
            return {
                label: label,
                owner: owner
            };
        }
    };

    MontageScope.prototype.getObject = function(label, owner) {
        var objects = this.documentPart.objects;
        var scopeOwner = objects.owner;
        var object;

        var objectMatches = function(object, objectLabel) {
            var metadata = object._montage_metadata;
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
    };

    Object.defineProperties(MontageScope.prototype, {
        _parentScope: {value: false, writable: true},
        parentScope: {
            get: function() {
                if (this._parentScope === false) {
                    this._parentScope = null;
                    if (this.documentPart.parentDocumentPart) {
                        this._parentScope = new MontageScope(
                            this.documentPart.parentDocumentPart);
                    }
                }

                return this._parentScope;
            }
        }
    });

    Object.defineProperties(MontageScope.prototype, {
        _iteration: {value: false, writable: true},
        iteration: {
            get: function() {
                if (this._iteration === false) {
                    this._iteration = null;
                    var documentPart = this.documentPart;
                    var objects = documentPart.objects;
                    var object;
                    var parentDocumentPart = documentPart.parentDocumentPart;

                    // If this scope has the same owner as the parent scope
                    // then it is the scope of an iteration.
                    if (parentDocumentPart &&
                        objects.owner === parentDocumentPart.objects.owner) {
                        // To find the iteration in the objects we search for
                        // an object with the same document part that isn't the
                        // owner.
                        for (var name in objects) {
                            object = objects[name];
                            if (object._templateDocumentPart === documentPart &&
                                name !== "owner") {
                                this._iteration = object;
                                break;
                            }
                        }
                    }
                }

                return this._iteration;
            }
        }
    });

    MontageScope.prototype.addObjects = function(objects, owner) {
        var object,
            ownerDocumentPart = owner._templateDocumentPart,
            iteration = this.iteration;

        for (var name in objects) {
            object = objects[name];
            // These components were created by a repetition
            if (iteration && object.element) {
                this._addObjectToIteration(owner, object, name);
            }

            ownerDocumentPart.objects[name] = objects[name];
        }

        if (iteration) {
            this._updateIterationBoundaries();
        }

        // TODO: Should we update the owner template objects if the
        // scope was an iteration? We do need to update the templateObjects.
        owner._addTemplateObjects(objects);
    };

    MontageScope.prototype._addObjectToIteration = function(owner, object, objectLabel) {
        var iteration = this.iteration;
        var documentPart = this.documentPart;
        var objects = documentPart.objects;
        var label = objectLabel;
        var repetition = iteration.repetition;
        var element = object.element;

        if (label in objects) {
            label = owner._montage_metadata.moduleId + "," + label;
        }

        objects[label] = object;
        if (element && repetition.element === element.parentNode) {
            var firstDraw = function() {
                object.removeEventListener("firstDraw", firstDraw, false);
                repetition._iterationForElement.set(element, iteration);
            };
            object.addEventListener("firstDraw", firstDraw, false);
        }
    };

    MontageScope.prototype._updateIterationBoundaries = function() {
        var iteration = this.iteration;
        var repetition = iteration.repetition;
        var index = iteration._drawnIndex;

        // Check to see if new elements were added to the bottom
        // boundary and move the text comment boundary if that's the
        // case. This only happens to the bottom boundary because new
        // elements at the start of the iteration are added with
        // insertBefore.
        var bottomBoundary = repetition._boundaries[index+1];
        var nextBoundary = repetition._boundaries[index+2];

        //jshint -W116
        if (bottomBoundary.nextSibling != nextBoundary) {
            var newBoundaryNextSibling = bottomBoundary;
            do {
                newBoundaryNextSibling = newBoundaryNextSibling.nextSibling;
            } while (newBoundaryNextSibling != nextBoundary);
            bottomBoundary.parentNode.insertBefore(bottomBoundary, newBoundaryNextSibling);
        }
        //jshint +W116

        repetition._iterationForElement.clear();
        iteration.forEachElement(function (element) {
            repetition._iterationForElement.set(element, iteration);
        });
    };

    /// MONTAGE TEMPLATE

    function MontageTemplate(template) {
        this.value = template;
    }

    MontageTemplate.find = function(moduleId) {
        var cssSelector = "*[" + ATTR_LE_COMPONENT + "='" + moduleId + "']";
        var element;

        element = document.querySelector(cssSelector);

        if (element) {
            return new MontageTemplate(element.component._template);
        }
    };

    MontageTemplate.prototype.addTemplateFragment = function(templateFragment, anchorLocation, how) {
        var container = document.createElement("div");
        var range = MontageTemplate._range;

        container.innerHTML = templateFragment.html;
        range.selectNodeContents(container);
        this._insertElement(range.extractContents(), anchorLocation, how);
        this._insertSerialization(JSON.parse(templateFragment.serialization));
    };

    MontageTemplate.prototype.addTemplateFragmentObjects = function(templateFragment) {
        this._insertSerialization(JSON.parse(templateFragment.serialization));
    };

    MontageTemplate.prototype._insertSerialization = function(serialization) {
        var template = this.value;
        var serializationObject = template.getSerialization().getSerializationObject();

        for (var label in serialization) {
            if (serialization.hasOwnProperty(label)) {
                serializationObject[label] = serialization[label];
            }
        }

        template.objectsString = JSON.stringify(serializationObject);
    };

    MontageTemplate.prototype._insertElement = function(element, anchorLocation, how) {
        var template = this.value;
        var anchor;
        var label = anchorLocation.label;
        var argumentName = anchorLocation.argumentName;
        var cssSelector;
        var scopeSelector;
        var node;

        var elementId = this.getComponentElementId(label);

        if (label === "owner") {
            scopeSelector = "*[" + ATTR_MONTAGE_ID + "='" + elementId + "']";
        } else {
            if (argumentName) {
                node = this.getComponentArgumentElement(label,
                    argumentName);
                scopeSelector = this._generateCSSSelectorFromComponent(label, node);
            } else {
                node = this.getComponentElement(label);
                // When dealing with star arguments the :scope will refer to the
                // first element of the argument range, if the component doesn't
                // have children this is a problem in the template (in the live
                // version we create a marker element for this purpose).
                // We need to detect this situation and change the how method to
                // "append" and use the component element as the scope element.
                if (node.children.length === 0) {
                    how = "append";
                    scopeSelector = "*[" + ATTR_MONTAGE_ID + "='" + elementId + "']";
                } else {
                    scopeSelector = "*[" + ATTR_MONTAGE_ID + "='" + elementId + "'] > *:nth-child(1)";
                }
            }
        }

        cssSelector = anchorLocation.cssSelector.replace(":scope", scopeSelector);

        anchor = template.document.querySelector(cssSelector);
        if (how === "before") {
            anchor.parentNode.insertBefore(element, anchor);
        } else if (how === "after") {
            anchor.parentNode.insertBefore(element, anchor.nextSibling);
        } else {
            anchor.appendChild(element);
        }
    };

    MontageTemplate.prototype._generateCSSSelectorFromComponent = function(label, element) {
        var componentElementId = this.getComponentElementId(label);
        var template = this.value;
        var cssSelector = "";
        var elementId;
        var index;

        do {
            index = element.parentNode.children.indexOf(element);
            cssSelector = cssSelector + " > *:nth-child(" + (index+1) + ")";
            element = element.parentNode;
            elementId = template.getElementId(element);
        } while (elementId !== componentElementId);

        cssSelector = "*[" + ATTR_MONTAGE_ID + "='" + componentElementId + "']" + cssSelector;

        return cssSelector;
    };

    // TODO: We need to move the logic from Component._getTemplateDomArgument
    // to Template in Montage so we can reuse it here.
    MontageTemplate.prototype.getComponentArgumentElement = function(label, argumentName) {
        var componentElementId = this.getComponentElementId(label);
        var template = this.value;
        var cssSelector = "*[" + ATTR_ARG + "='" + argumentName + "']";
        var elements = template.document.querySelectorAll(cssSelector);
        var element;
        var node;
        var elementId;

        if (elements.length > 1) {
            // It's possible that there are other arguments with the same name
            // in inner components of the "label" component. We need to check
            // each one to find out the one directly under the "label"
            // component.
            elementsLoop:
            for (var i = 0; element =/*assign*/ elements[i]; i++) {
                node = element;
                while (node = node.parentNode) {
                    elementId = template.getElementId(node);
                    if (elementId) {
                        if (elementId === componentElementId) {
                            // Our work here is done, we found the one we're
                            // looking for so we exit the search immediately.
                            break elementsLoop;
                        } else {
                            // This argument belongs to a different component,
                            // no need to continue up the DOM tree, we go for
                            // the next element.
                            break;
                        }
                    }
                }
            }

            return element;
        } else {
            return elements[0];
        }
    };

    MontageTemplate.prototype.getComponentElementId = function(label) {
        var serialization = this.value.getSerialization().getSerializationObject();

        return serialization[label].properties.element["#"];
    };

    MontageTemplate.prototype.getComponentElement = function(label) {
        var elementId = this.getComponentElementId(label);

        return this.value.getElementById(elementId);
    };

    MontageTemplate._range = document.createRange();
})(window.Declarativ);
//jshint +W030
//jshint +W106
//jshint +W089