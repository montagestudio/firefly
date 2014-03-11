var Promise = require("montage/core/promise").Promise;
var findObject = require("core/spec-helper").findObject;
var findObjects = require("core/spec-helper").findObjects;

/* global describe, Declarativ */
module.exports = function() {
    var LiveEdit = Declarativ.LiveEdit;
    var mainModuleId = "components/ui/main.reel";
    var result;

    describe("add components", function() {
        it("should add new component to an owner", function() {
            var serialization = {
                "newButton": {
                    "prototype": "digit/ui/button.reel",
                    "properties": {
                        "element": {"#": "newButton"}
                    }
                }
            };
            var templateFragment = {
                serialization: JSON.stringify(serialization),
                html: '<div data-montage-id="newButton"></div>'
            };
            result = LiveEdit.addTemplateFragment(
                mainModuleId,
                {
                    label: "owner",
                    argumentName: "",
                    cssSelector: ":scope > :nth-child(1)"
                },
                "before",
                templateFragment);

            return Promise.resolve(result).then(function() {
                var newComponent = findObject(mainModuleId, "newButton");

                expect(newComponent).toBeDefined();
            });
        });

        it("should add new component to a repetition", function() {
            var serialization = {
                "newTextField": {
                    "prototype": "digit/ui/text-field.reel",
                    "properties": {
                        "element": {"#": "newTextField"}
                    }
                }
            };
            var templateFragment = {
                serialization: JSON.stringify(serialization),
                html: '<input data-montage-id="newTextField">'
            };
            result = LiveEdit.addTemplateFragment(
                mainModuleId,
                {
                    label: "items",
                    argumentName: "",
                    cssSelector: ":scope > :nth-child(1)"
                },
                "before",
                templateFragment);

            return Promise.resolve(result).then(function() {
                var newComponents = findObjects(mainModuleId, "newTextField");

                expect(newComponents.length).toBe(3);
                Array.prototype.forEach.call(newComponents, function(newComponent) {
                    expect(newComponent).toBeDefined();
                });
            });
        });
    });

    describe("delete components", function() {
        it("should delete a component", function() {
            result = LiveEdit.deleteObject(mainModuleId, "slider");

            return Promise.resolve(result).then(function() {
                var owner = findObject(mainModuleId, "owner");
                var document = owner._template.document;
                var element;

                element = document.querySelector("*[data-montage-id='slider']");
                expect(element.outerHTML).toBe('<span data-montage-id="slider"></span>');
            });
        });

        it("should delete all instances of a component", function() {
            result = LiveEdit.deleteObject(mainModuleId, "itemSlider");

            return Promise.resolve(result).then(function() {
                var owner = findObject(mainModuleId, "owner");
                var document = owner._template.document;
                var elements;
                var element;

                elements = document.querySelectorAll("*[data-montage-id='itemSlider']");

                for (var i = 0; element =/*assign*/ elements[i]; i++) {
                    expect(element.outerHTML).toBe('<span data-montage-id="itemSlider"></span>');
                }
            });
        });
    });
};