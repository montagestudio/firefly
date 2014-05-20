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

    _Template: {
        value: null,
        writable: true
    },

    Template: {
        get: function() {
            if (!this._Template) {
                this._Template = montageRequire("core/template").Template;
            }

            return this._Template;
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
    },

    _applicationReady: {
        value: null,
        writable: true
    },
    /**
     * This function returns a promise for the application ready.
     * The application is considered ready when the root component is available
     * and the main component has completely loaded its component tree.
     */
    applicationReady: {
        value: function() {
            if (!this._applicationReady) {
                var phases = [this._checkRootComponentAvailability,
                              this._checkMainComponentOnScreen];
                var phaseNr = 0;
                var deferred = this._applicationReady = this.Promise.defer();
                var checkApplicationReady = function() {
                    var isPhaseReady = phases[phaseNr].call(this);

                    if (isPhaseReady) {
                        phaseNr++;
                    }

                    if (phaseNr === phases.length) {
                        deferred.resolve();
                    } else {
                        setTimeout(checkApplicationReady, 250);
                    }
                };
                checkApplicationReady();
            }
            return this._applicationReady.promise;
        }
    },

    _checkRootComponentAvailability: {
        value: function() {
            return montageRequire.getModuleDescriptor("ui/component").exports;
        }
    },

    _checkMainComponentOnScreen: {
        value: function() {
            var main = Declarativ.LiveEdit.MontageComponent.findAll("ui/main.reel")[0];

            if (main && main.value.element.parentNode) {
                return true;
            } else {
                return false;
            }
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
    var UPDATE_TEMPLATE_TIMEOUT = 500;

    ns.LiveEdit = Object.create(Object.prototype, {
        _bufferedTemplateChanges: {
            value: {}
        },
        /**
         * Schedule a template update operation to change object properties in
         * the template.
         * The template will be updated when there were no more
         * setObjectProperties operations requested for a specific amount of
         * time. This way we make sure this heavy operation never interfears
         * with the processing of a long stream of setObjectProperties
         * operations.
         */
        _scheduleSetObjectPropertiesUpdateTemplate: {
            value: function(label, ownerModuleId, properties) {
                var self = this;
                var key = label+"@"+ownerModuleId;
                var templateChange = this._bufferedTemplateChanges[key];

                if (!templateChange) {
                    templateChange = {};
                    this._bufferedTemplateChanges[key] = templateChange;
                    var updateTemplateFunction = function() {
                        var interval = window.performance.now() - templateChange.lastChangeTimestamp;
                        if (interval < UPDATE_TEMPLATE_TIMEOUT) {
                            setTimeout(updateTemplateFunction,
                                UPDATE_TEMPLATE_TIMEOUT);
                        } else {
                            delete self._bufferedTemplateChanges[key];
                            // There's the possibility that a new object of this
                            // type was instantiated between the last object
                            // change and this template change, that object will
                            // still get the previous values. A way to get
                            // around that is by changing all instances of the
                            // object again with this template update, but I
                            // won't do it for now because I don't think it's
                            // that likely to happen.
                            self._setObjectPropertiesUpdateTemplate(label,
                                ownerModuleId, templateChange.properties);
                        }
                    };
                    setTimeout(updateTemplateFunction, UPDATE_TEMPLATE_TIMEOUT);
                }
                templateChange.lastChangeTimestamp = window.performance.now();
                templateChange.properties = properties;
            }
        },
        _setObjectPropertiesUpdateTemplate: {
            value: function(label, ownerModuleId, properties) {
                MontageTemplate.load(ownerModuleId).then(function(montageTemplate) {
                    montageTemplate.setObjectProperties(label, properties);
                });
            }
        },
        setObjectProperties: {
            value: function(label, ownerModuleId, properties) {
                var montageObjects = MontageObject.findAll(ownerModuleId, label);
                var object;

                this._scheduleSetObjectPropertiesUpdateTemplate(label, ownerModuleId, properties);

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

        // Note to self: This function is bad and you should feel bad!
        // (\/) (;,,;) (\/)
        setObjectProperty: {
            value: function(ownerModuleId, label, propertyName, propertyValue, propertyType) {
                var self = this,
                    montageObjects,
                    montageTemplatePromise;

                montageTemplatePromise = MontageTemplate.load(ownerModuleId);

                // TODO: use the same strategy to find nodes as
                // _updateLiveEditArgumentAttribute
                if (propertyType === "element") {
                    return montageTemplatePromise
                    .then(function(montageTemplate) {
                        // Add to the owner template
                        montageTemplate.setObjectPropertyWithElement(label, propertyName, propertyValue.elementId);
                        // Update the live application
                        return self._setObjectPropertyWithElement(ownerModuleId,
                            label, propertyName, propertyValue);
                    });
                } else if (propertyType === "object") {
                    return montageTemplatePromise
                    .then(function(montageTemplate) {
                        // Add to the owner template
                        montageTemplate.setObjectPropertyWithObject(label, propertyName, propertyValue.label);
                        // Update the live application
                        return self._setObjectPropertyWithObject(ownerModuleId,
                            label, propertyName, propertyValue.label);
                    });
                } else {
                    return montageTemplatePromise
                    .then(function(montageTemplate) {
                        // Add to the owner template
                        montageTemplate.setObjectProperty(label, propertyName, propertyValue);

                        // Update the live application
                        montageObjects = MontageObject.findAll(ownerModuleId, label);

                        for (var i = 0, montageObject; (montageObject = montageObjects[i]); i++) {
                            montageObject.setProperty(propertyName, propertyValue);
                        }
                    });
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
                    montageObject,
                    promises = [];

                montageElements = MontageElement.findAll(ownerModuleId,
                    elementValue.label, elementValue.argumentName,
                    elementValue.cssSelector);

                for (var i = 0, montageElement; montageElement = montageElements[i]; i++) {
                    // TODO: should look this object in the scope. Could be
                    // setting an object that already has an element and is
                    // inside a repetition.
                    object = montageElement.owner._templateDocumentPart.objects[label];
                    if (!object) {
                        continue;
                    }

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
                        montageObject = new MontageObject(object, label,
                            montageElement.owner,
                            montageElement.owner._templateDocumentPart);
                        montageObject.setProperty(propertyName,
                            montageElement.value);
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
                    montageObject.setProperty(propertyName, object);
                }
            }
        },

        setObjectLabel: {
            value: function(ownerModuleId, label, newLabel) {
                var montageObjects;
                var montageObject;

                return MontageTemplate.load(ownerModuleId)
                .then(function(montageTemplate) {
                    // Add to the owner template
                    montageTemplate.setObjectLabel(label, newLabel);

                    // Update the live application
                    montageObjects = MontageObject.findAll(ownerModuleId, label);
                    for (var i = 0; (montageObject = montageObjects[i]); i++) {
                        montageObject.setLabel(newLabel);
                    }
                });
            }
        },

        setObjectBinding: {
            value: function(ownerModuleId, label, binding) {
                var montageObjects;

                return MontageTemplate.load(ownerModuleId)
                .then(function(montageTemplate) {
                    // Add to the owner template
                    montageTemplate.addObjectBinding(label, binding.propertyName,
                        binding.propertyDescriptor);

                    // Update the live application
                    montageObjects = MontageObject.findAll(ownerModuleId, label);

                    for (var i = 0, montageObject; (montageObject = montageObjects[i]); i++) {
                        montageObject.defineBinding(binding.propertyName,
                            binding.propertyDescriptor);
                    }
                });
            }
        },

        deleteObjectBinding: {
            value: function(ownerModuleId, label, path) {
                var montageObjects;

                return MontageTemplate.load(ownerModuleId)
                .then(function(montageTemplate) {
                    // Add to the owner template
                    montageTemplate.cancelObjectBinding(label, path);

                    // Update the live application
                    montageObjects = MontageObject.findAll(ownerModuleId, label);
                    for (var i = 0, montageObject; (montageObject = montageObjects[i]); i++) {
                        montageObject.cancelBinding(path);
                    }
                });
            }
        },

        addTemplateFragment: {
            value: function(ownerModuleId, elementLocation, how, templateFragment) {
                var promises = [];
                var montageElements;
                var template;

                // Add to the owner template
                return MontageTemplate.load(ownerModuleId)
                .then(function(montageTemplate) {
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
                });
            }
        },

        addTemplateFragmentObjects: {
            value: function(ownerModuleId, templateFragment) {
                var montageComponents;
                var template;
                var promises = [];

                return MontageTemplate.load(ownerModuleId)
                .then(function(montageTemplate) {
                    // Add to the owner template
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
                });
            }
        },

        deleteObject: {
            value: function(ownerModuleId, label) {
                var montageObjects;
                var promises = [];

                return MontageTemplate.load(ownerModuleId)
                .then(function(montageTemplate) {
                    // Delete from the owner template
                    montageTemplate.deleteObject(label);

                    // Update the live application
                    montageObjects = MontageObject.findAll(ownerModuleId, label);
                    for (var i = 0, montageObject; (montageObject = montageObjects[i]); i++) {
                        promises.push(
                            montageObject.destroy()
                        );
                    }

                    return Declarativ.Promise.all(promises);
                });
            }
        },

        deleteElement: {
            value: function(ownerModuleId, elementLocation) {
                var montageElements;
                var montageElement;
                var promises = [];

                return MontageTemplate.load(ownerModuleId)
                .then(function(montageTemplate) {
                    // Delete from the owner template
                    montageTemplate.deleteElement(elementLocation);

                    // Update the live application
                    montageElements = MontageElement.findAll(ownerModuleId, elementLocation.label, elementLocation.argumentName, elementLocation.cssSelector);
                    for (var i = 0; (montageElement = montageElements[i]); i++) {
                        promises.push(
                            montageElement.destroy()
                        );
                    }

                    return Declarativ.Promise.all(promises);
                });
            }
        },

        setElementAttribute: {
            value: function(ownerModuleId, elementLocation, attributeName, attributeValue) {
                var montageElements;

                return MontageTemplate.load(ownerModuleId)
                .then(function(montageTemplate) {
                    // Add to the owner template
                    montageTemplate.setElementAttribute(elementLocation, attributeName, attributeValue);

                    // Update the live application
                    montageElements = MontageElement.findAll(ownerModuleId,
                        elementLocation.label, elementLocation.argumentName, elementLocation.cssSelector);

                    for (var i = 0, montageElement; montageElement = montageElements[i]; i++) {
                        montageElement.value.setAttribute(attributeName,
                            attributeValue);
                    }
                });
            }
        },

        addObjectEventListener: {
            value: function(ownerModuleId, label, type, listenerLabel, useCapture) {
                var montageObjects;

                return MontageTemplate.load(ownerModuleId)
                .then(function(montageTemplate) {
                    // Add to the owner template
                    montageTemplate.addObjectEventListener(label, type, listenerLabel,
                        useCapture);

                    // Update the live application
                    montageObjects = MontageObject.findAll(ownerModuleId, label);
                    for (var i = 0, montageObject; (montageObject = montageObjects[i]); i++) {
                        montageObject.addEventListener(type, listenerLabel,
                            useCapture);
                    }
                });
            }
        },

        removeObjectEventListener: {
            value: function(ownerModuleId, label, type, listenerLabel, useCapture) {
                var montageObjects;

                return MontageTemplate.load(ownerModuleId)
                .then(function(montageTemplate) {
                    // Add to the owner template
                    montageTemplate.removeObjectEventListener(label, type, listenerLabel,
                        useCapture);

                    // Update the live application
                    montageObjects = MontageObject.findAll(ownerModuleId, label);
                    for (var i = 0, montageObject; (montageObject = montageObjects[i]); i++) {
                        montageObject.removeEventListener(type, listenerLabel,
                            useCapture);
                    }
                });
            }
        },

        _updatedCssFiles: {
            value: {}
        },
        updateCssFileContent: {
            value: function(url, content) {

                var protocolRegex = /^\S+:\/\//;

                // Ignore the protocol; we're constructing the url assuming https,
                // but often serving the preview over http
                url = url.replace(protocolRegex, "");

                if (url in this._updatedCssFiles) {
                    this._updatedCssFiles[url].textContent = content;
                } else {
                    var links = document.querySelectorAll("link");

                    for (var i = 0, link; link =/*assign*/ links[i]; i++) {
                        if (link.href.replace(protocolRegex, "") === url) {
                            var style = document.createElement("style");
                            style.textContent = content;
                            link.parentNode.insertBefore(style, link);
                            link.parentNode.removeChild(link);
                            this._updatedCssFiles[url] = style;
                            break;
                        }
                    }
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
        var instances;

        documentPart = documentPart || owner._templateDocumentPart;

        instances = Object.create(documentPart.objects);
        instances.owner = owner;

        deserializer.init(this.serializationString, require);
        return deserializer.deserialize(instances, element)
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
        this.scope.invalidateTemplates(this.owner);
    };

    MontageObject.prototype.setProperty = function(propertyName, propertyValue) {
        this.value[propertyName] = propertyValue;
        this.scope.invalidateTemplates(this.owner);
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
        this.scope.invalidateTemplates(owner);
    };

    MontageObject.prototype.cancelBinding = function(path) {
        if (this.value.getBinding(path)) {
            this.value.cancelBinding(path);
            this.scope.invalidateTemplates(this.owner);
        }
    };

    MontageObject.prototype.addEventListener = function(type, listenerLabel, useCapture) {
        var listener = this.scope.lookupObject(listenerLabel, this.owner);
        this.value.addEventListener(type, listener, useCapture);
        this.scope.invalidateTemplates(this.owner);
    };

    MontageObject.prototype.removeEventListener = function(type, listenerLabel, useCapture) {
        var listener = this.scope.lookupObject(listenerLabel, this.owner);
        this.value.removeEventListener(type, listener, useCapture);
        this.scope.invalidateTemplates(this.owner);
    };

    MontageObject.prototype.destroy = function() {
        this.scope.deleteObject(this.label);
        this.scope.invalidateTemplates(this.owner);
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

    Object.defineProperties(MontageComponent.prototype, {
        _montageElement: {value: false, writable: true},
        montageElement: {
            get: function() {
                if (this._montageElement === false) {
                    this._montageElement = new MontageElement(this.value.element, this.owner._montage_metadata.moduleId, this.label);
                }

                return this._montageElement;
            }
        }
    });

    MontageComponent.prototype.findCloners = function() {
        var montageComponents = [];
        var findObjects = function(component) {
            var childComponents = component.childComponents;
            var childComponent;

            for (var i = 0; (childComponent = childComponents[i]); i++) {
                if (childComponent.clonesChildComponents) {
                    montageComponents.push(
                        new MontageComponent(childComponent, childComponent._montage_metadata.label));
                }
                findObjects(childComponent);
            }
        };

        findObjects(this.value);
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
            montageElement.scope.invalidateTemplates(owner);
            // This exact operation (creating the template) might happen
            // several times if the elements are in a repetition....
            // Should try to optimize this somehow.
            template = Template.createTemplateWithObject(owner._template, label);
            template.removeComponentElementReferences();
            return template.instantiate(owner, element, documentPart)
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

    MontageComponent.prototype.destroy = function() {
        this.scope.deleteObject(this.label);
        return this.montageElement.rebuild();
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
        var ownerComponent = component.ownerComponent;

        // MON-646
        if (!ownerComponent) {
            return false;
        }
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
        var parentComponent;

        if (how === "append") {
            parentComponent = this.component || this.parentComponent;
        } else {
            parentComponent = this.parentComponent;
        }

        this.scope.invalidateTemplates(owner);
        return template.instantiateIntoDocument(this, how)
            .then(function(result) {
                var deferred;
                var promises = [];

                self.scope.addObjects(result.objects, owner);
                if (self.label !== "owner") {
                    self.updateLiveEditAttributes(result.firstElement,
                        result.lastElement);
                }

                for (var label in result.objects) {
                    var object = result.objects[label];
                    // Wait for all immediate child components to be drawn to
                    // consider the template added to the document.
                    // This ensures that the next changes will be able to see
                    // the new components created by this template adition.
                    if (object.parentComponent === parentComponent) {
                        deferred = Declarativ.Promise.defer();
                        object.addEventListener("firstDraw", deferred.resolve, false);
                        promises.push(deferred.promise);
                    }
                }
                return Declarativ.Promise.all(promises);
            });
    };

    MontageElement.prototype.findChildComponents = function() {
        var childComponents,
            searchChildComponents;

        if (this.value.component) {
            return [this.value.component];
        } else {
            childComponents = [];
            searchChildComponents = function(node) {
                var elements = node.children;
                for (var i = 0, element; element =/*assign*/ elements[i]; i++) {
                    if (element.component) {
                        childComponents.push(element.component);
                    } else {
                        searchChildComponents(element);
                    }
                }
            };
            searchChildComponents(this.value);
            return childComponents;
        }
    };

    MontageElement.prototype.destroy = function() {
        var element = this.value;
        var childComponents;
        var childComponent;
        var nextSibling = element.nextElementSibling;
        var previousSibling = element.previousElementSibling;
        var leArgRangeValue;

        this.scope.invalidateTemplates(this.owner);
        element.parentNode.removeChild(element);
        childComponents = this.findChildComponents();
        for (var i = 0; childComponent =/*assign*/ childComponents[i]; i++) {
            childComponent.detachFromParentComponent();
            childComponent.cleanupDeletedComponentTree(true);
        }

        leArgRangeValue = this.owner._montage_metadata.moduleId + "," +
            this.label;
        this._updateLiveEditRangeAttributes(ATTR_LE_ARG_BEGIN, leArgRangeValue, nextSibling);
        this._updateLiveEditRangeAttributes(ATTR_LE_ARG_END, leArgRangeValue, previousSibling);
    };

    MontageElement.prototype.rebuild = function() {
        var element = this.value;
        var parentNode = element.parentNode;
        var nextSibling = element.nextSibling;

        this.destroy();
        return this._rebuild(parentNode, nextSibling);
    };

    MontageElement.prototype._rebuild = function(parentNode, nextSibling) {
        var scope = this.scope;
        var montageTemplate = this.montageTemplate;
        var instantiatePromise;

        instantiatePromise = montageTemplate.instantiateFromElementId(this.montageId, scope);

        return instantiatePromise.then(function(documentPart) {
            var promises = [],
                childComponents = documentPart.childComponents,
                childComponent;

            scope.mergeDocumentPart(documentPart);

            parentNode.insertBefore(documentPart.fragment, nextSibling);
            for (var i = 0; childComponent =/*assign*/ childComponents[i]; i++) {
                childComponent.attachToParentComponent();
                promises.push(childComponent.loadComponentTree());
            }

            return Declarativ.Promise.all(promises);
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
        component: {
            get: function() {
                return this.value.component;
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

    Object.defineProperties(MontageElement.prototype, {
        _montageId: {value: false, writable: true},
        montageId: {
            get: function() {
                if (this._montageId === false) {
                    this._montageId = this.value.getAttribute(ATTR_MONTAGE_ID);
                }

                return this._montageId;
            }
        }
    });

    /**
     * The template where this element is declared.
     */
    Object.defineProperties(MontageElement.prototype, {
        _montageTemplate: {value: false, writable: true},
        montageTemplate: {
            get: function() {
                if (this._montageTemplate === false) {
                    this._montageTemplate = new MontageTemplate(this.documentPart.template, this.owner._montage_metadata.moduleId);
                }

                return this._montageTemplate;
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
        var scopeLabel = this.getObjectScopeLabel(label, owner);

        if (scopeLabel) {
            return objects[scopeLabel];
        } else {
            return null;
        }
    };

    MontageScope.prototype.getObjectScopeLabel = function(label, owner) {
        var objects = this.documentPart.objects;
        var scopeOwner = objects.owner;
        var object;

        owner = owner || scopeOwner;

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
            return label;
        }

        // Let's go for the slow track then, need to search all objects
        // define in this scope to check its original label. The object
        // might be an argument that replaced a parameter (repetition
        // will do this).
        for (var name in objects) {
            object = objects[name];
            if (objectMatches(object, name)) {
                return name;
            }
        }

        return null;
    };

    MontageScope.prototype.mergeDocumentPart = function(documentPart) {
        var srcObjects = documentPart.objects;
        var objects = this.documentPart.objects;

        for (var label in srcObjects) {
            objects[label] = srcObjects[label];
        }
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

    MontageScope.prototype.deleteObject = function(label, owner) {
        var scopeLabel,
            objects = this.documentPart.objects,
            object;

        scopeLabel = this.getObjectScopeLabel(label, owner);
        object = objects[scopeLabel];
        delete objects[scopeLabel];

        return object;
    };

    MontageScope.prototype.invalidateTemplates = function(owner) {
        var scope = this;
        var iteration;
        var scopeOwner;

        do {
            iteration = scope.iteration;

            if (iteration) {
                iteration.repetition._iterationTemplate.isDirty = true;
            } else {
                // We're only interested in owners of components, not iterations.
                // The owner of an iteration will be the same as the owner of
                // the scope that contains the iteration.
                // If we updated the scopeOwner in an iteration scope we would
                // stop this cycle before hitting the scope of the actual owner.
                scopeOwner = scope.documentPart.objects.owner;
            }

            scope = scope.parentScope;
        } while (scopeOwner !== owner);
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

        iteration.forEachElement(function (element) {
            repetition._iterationForElement.set(element, iteration);
        });
    };

    /// MONTAGE TEMPLATE

    function MontageTemplate(template, moduleId) {
        this.value = template;
        this.moduleId = moduleId;
    }

    MontageTemplate.find = function(moduleId) {
        var cssSelector = "*[" + ATTR_LE_COMPONENT + "='" + moduleId + "']";
        var element;

        element = document.querySelector(cssSelector);

        if (element) {
            return new MontageTemplate(element.component._template, moduleId);
        }
    };

    MontageTemplate.getTemplateModuleIdForComponent = function(moduleId) {
        return moduleId.replace(/([^\/]+)\.reel$/, "$1.reel/$1.html");
    };

    MontageTemplate.load = function(moduleId) {
        var templateModuleId = this.getTemplateModuleIdForComponent(moduleId);

        return Declarativ.Template.getTemplateWithModuleId(templateModuleId, require)
        .then(function(template) {
            return new MontageTemplate(template, moduleId);
        });
    };

    MontageTemplate.prototype.addTemplateFragment = function(templateFragment, anchorLocation, how) {
        var container = document.createElement("div");
        var range = MontageTemplate._range;

        container.innerHTML = templateFragment.html;
        range.selectNodeContents(container);
        this._insertElement(range.extractContents(), anchorLocation, how);
        if (templateFragment.serialization) {
            this._insertSerialization(JSON.parse(templateFragment.serialization));
        }

        this._clearCaches();
    };

    MontageTemplate.prototype.addTemplateFragmentObjects = function(templateFragment) {
        this._insertSerialization(JSON.parse(templateFragment.serialization));
    };

    MontageTemplate.prototype.instantiateFromElementId = function(elementId, scope) {
        return this._instantiateFromElement(
            this.value.getElementById(elementId), scope);
    };

    MontageTemplate.prototype.instantiateFromElementLocation = function(elementLocation, scope) {
        var element = this.getElementByElement(elementLocation);
        return this._instantiateFromElement(element, scope);
    };

    MontageTemplate.prototype._instantiateFromElement = function(element, scope) {
        var template;
        var range = MontageTemplate._range;
        var externalObjectLabels;
        var externalObjects = Object.create(null);

        range.selectNode(element);
        template = this.value.createTemplateFromRange(range);

        externalObjectLabels = template.getSerialization().getExternalObjectLabels();
        for (var i = 0, label; (label = externalObjectLabels[i]); i++) {
            externalObjects[label] = scope.getObject(label);
        }
        template.setInstances(externalObjects);

        return template.instantiate(document);
    };

    MontageTemplate.prototype._clearCaches = function() {
        // This is the simplest way to clear the cache, a more advanced way
        // would be to only clear the elements that were modified.
        // To do this we need to receive an element id and clear all element
        // ids we find while going up the DOM tree to the owner.
        this.value.clearTemplateFromElementContentsCache();

        // Invalidate repetition templates if they have 0 iterations.
        // This is a problem I don't know how to solve, which is finding the
        // repetitions affected by a change in MontageTemplate when they don't
        // have iterations. We're not able to find them in the DOM, and
        // it's not possible to know where the contents of the repetition are
        // going to end up in the DOM. They can be passed around deep
        // down the DOM tree with data parameters.
        // To get around this we find all repetitions with 0 iterations
        // (down this template) and invalidate them.
        var components = MontageComponent.findAll(this.moduleId);
        var cloners;
        for (var i = 0, component; component = /*assign*/components[i]; i++) {
            cloners = component.findCloners();
            for (var j = 0, cloner; cloner = /*assign*/cloners[j]; j++) {
                if (cloner.value.iterations.length === 0) {
                    cloner.value._iterationTemplate.isDirty = true;
                    cloner.scope.invalidateTemplates(component.value);
                }
            }
        }
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

    MontageTemplate.prototype._findElement = function(elementLocation) {
        var template = this.value;
        var label = elementLocation.label;
        var argumentName = elementLocation.argumentName;
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
                // We need to detect this situation and use the component
                // element as the scope element.
                if (node.children.length === 0) {
                    scopeSelector = "*[" + ATTR_MONTAGE_ID + "='" + elementId + "']";
                } else {
                    scopeSelector = "*[" + ATTR_MONTAGE_ID + "='" + elementId + "'] > *:nth-child(1)";
                }
            }
        }

        cssSelector = elementLocation.cssSelector.replace(":scope", scopeSelector);

        return template.document.querySelector(cssSelector);
    };

    MontageTemplate.prototype._insertElement = function(element, anchorLocation, how) {
        var anchor;
        var node;
        var label = anchorLocation.label;

        // When dealing with star arguments the :scope will refer to the
        // first element of the argument range, if the component doesn't
        // have children this is a problem in the template (in the live
        // version we create a marker element for this purpose).
        // We need to detect this situation and change the how method to
        // "append" and use the component element as the scope element.
        if (label !== "owner" && !anchorLocation.argumentName) {
            node = this.getComponentElement(label);
            if (node.children.length === 0) {
                how = "append";
            }
        }

        anchor = this._findElement(anchorLocation);
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

    MontageTemplate.prototype.deleteObject = function(label) {
        var template = this.value;
        var serializationObject = template.getSerialization().getSerializationObject();

        delete serializationObject[label];
        template.objectsString = JSON.stringify(serializationObject);

        this._clearCaches();
    };

    MontageTemplate.prototype.deleteElement = function(elementLocation) {
        var template = this.value;
        var element;
        var serializationObject = template.getSerialization().getSerializationObject();

        element = this._findElement(elementLocation);
        element.parentNode.removeChild(element);

        template.objectsString = JSON.stringify(serializationObject);

        this._clearCaches();
    };

    MontageTemplate.prototype.setElementAttribute = function(elementLocation, attributeName, attributeValue) {
        var element;

        element = this._findElement(elementLocation);
        element.setAttribute(attributeName, attributeValue);

        this._clearCaches();
    };

    MontageTemplate.prototype.addObjectBinding = function(label, path, descriptor) {
        var template = this.value;
        var serializationObject = template.getSerialization().getSerializationObject();
        var object = serializationObject[label];
        var bindings = object.bindings;

        if (!bindings) {
            object.bindings = bindings = {};
        }
        bindings[path] = descriptor;
        template.objectsString = JSON.stringify(serializationObject);

        this._clearCaches();
    };

    MontageTemplate.prototype.cancelObjectBinding = function(label, path) {
        var template = this.value;
        var serializationObject = template.getSerialization().getSerializationObject();
        var object = serializationObject[label];

        delete object.bindings[path];
        template.objectsString = JSON.stringify(serializationObject);

        this._clearCaches();
    };

    MontageTemplate.prototype.addObjectEventListener = function(label, type, listenerLabel, useCapture) {
        var template = this.value;
        var serializationObject = template.getSerialization().getSerializationObject();
        var object = serializationObject[label];
        var listeners = object.listeners;

        if (!listeners) {
            object.listeners = listeners = [];
        }
        listeners.push({
            type: type,
            listener: {"@": listenerLabel},
            useCapture: useCapture
        });
        template.objectsString = JSON.stringify(serializationObject);

        this._clearCaches();
    };

    MontageTemplate.prototype.removeObjectEventListener = function(label, type, listenerLabel, useCapture) {
        var template = this.value;
        var serializationObject = template.getSerialization().getSerializationObject();
        var object = serializationObject[label];
        var listeners = object.listeners;
        var listener;

        for (var i = 0; listener =/*assign*/ listeners[i]; i++) {
            if (listener.type === type &&
                listener.listener["@"] === listenerLabel &&
                //jshint -W116
                listener.useCapture == useCapture) {
                //jshint +W116
                break;
            }
        }

        listeners.splice(i, 1);
        template.objectsString = JSON.stringify(serializationObject);

        this._clearCaches();
    };

    MontageTemplate.prototype.setObjectProperty = function(label, propertyName, propertyValue) {
        var template = this.value;
        var serializationObject = template.getSerialization().getSerializationObject();
        var object = serializationObject[label];
        var properties = object.properties;

        if (!properties) {
            object.properties = properties = {};
        }
        properties[propertyName] = propertyValue;
        template.objectsString = JSON.stringify(serializationObject);

        this._clearCaches();
    };

    MontageTemplate.prototype.setObjectProperties = function(label, properties) {
        var template = this.value;
        var serializationObject = template.getSerialization().getSerializationObject();
        var object = serializationObject[label];
        var objectProperties = object.properties;

        if (!objectProperties) {
            object.properties = objectProperties = {};
        }
        for (var propertyName in properties) {
            if (properties.hasOwnProperty(propertyName)) {
                objectProperties[propertyName] = properties[propertyName];
            }
        }
        template.objectsString = JSON.stringify(serializationObject);

        this._clearCaches();
    };

    MontageTemplate.prototype.setObjectPropertyWithElement = function(label, propertyName, elementId) {
        var template = this.value;
        var serializationObject = template.getSerialization().getSerializationObject();
        var object = serializationObject[label];
        var properties = object.properties;

        if (!properties) {
            object.properties = properties = {};
        }
        properties[propertyName] = {"#": elementId};
        template.objectsString = JSON.stringify(serializationObject);

        this._clearCaches();
    };

    MontageTemplate.prototype.setObjectPropertyWithObject = function(label, propertyName, objectLabel) {
        var template = this.value;
        var serializationObject = template.getSerialization().getSerializationObject();
        var object = serializationObject[label];
        var properties = object.properties;

        if (!properties) {
            object.properties = properties = {};
        }
        properties[propertyName] = {"@": objectLabel};
        template.objectsString = JSON.stringify(serializationObject);

        this._clearCaches();
    };

    MontageTemplate.prototype.setObjectLabel = function(label, newLabel) {
        var template = this.value;
        var serializationObject = template.getSerialization().getSerializationObject();

        serializationObject[newLabel] = serializationObject[label];
        delete serializationObject[label];

        template.objectsString = JSON.stringify(serializationObject);

        this._clearCaches();
    };

    MontageTemplate._range = document.createRange();

    ns.LiveEdit.MontageComponent = MontageComponent;
    ns.LiveEdit.MontageElement = MontageElement;
})(window.Declarativ);
//jshint +W030
//jshint +W106
//jshint +W089