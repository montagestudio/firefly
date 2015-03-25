var Promise = require("montage/core/promise").Promise;
var Template = require("montage/core/template").Template;
var findOwner = require("core/spec-helper").findOwner;
var getMontageId = require("core/spec-helper").getMontageId;

/* global describe, window, MontageStudio */
module.exports = function() {
    var LiveEdit = MontageStudio.LiveEdit;
    var mainModuleId = "components/ui/main.reel";
    var result;

    describe("components in the owner template", function() {
        it("should change the template markup and declaration when a component is added", function() {
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
                html: '<div data-montage-id="newButton" class="newButton"></div>'
            };
            result = LiveEdit.addTemplateFragment(
                mainModuleId,
                {
                    label: "owner",
                    argumentName: "",
                    cssSelector: ":scope > :nth-child(1)"
                },
                "after",
                templateFragment);

            return Promise.resolve(result).then(function() {
                var owner = findOwner(mainModuleId);
                var serializationObject = owner._template.getSerialization().getSerializationObject();
                var component = serializationObject.newButton;
                var document = owner._template.document;
                var element = document.getElementsByClassName("newButton")[0];

                expect(component).toBeDefined();
                expect(getMontageId(element.previousElementSibling)).toBe("text");
                expect(getMontageId(element.nextElementSibling)).toBe("textField");
            });
        });
    });

    describe("adding components to components not part of the running application", function() {
        it("should still load and change the template", function() {
            var serialization = {
                "button": {
                    "prototype": "digit/ui/button.reel",
                    "properties": {
                        "element": {"#": "button"}
                    }
                }
            };
            var templateFragment = {
                serialization: JSON.stringify(serialization),
                html: '<div data-montage-id="button" class="button"></div>'
            };
            result = LiveEdit.addTemplateFragment(
                "ui/simple.reel",
                {
                    label: "owner",
                    argumentName: "",
                    cssSelector: ":scope"
                },
                "append",
                templateFragment);

            return Promise.resolve(result).then(function() {
                return Template.getTemplateWithModuleId("ui/simple.reel/simple.html", window.require)
                .then(function(template) {
                    var serializationObject = template.getSerialization().getSerializationObject();
                    expect(serializationObject.button).toBeDefined();
                });
            });
        });
    });
};