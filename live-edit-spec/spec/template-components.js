var Promise = require("montage/core/promise").Promise;
var findOwner = require("core/spec-helper").findOwner;
var getMontageId = require("core/spec-helper").getMontageId;

/* global describe, MontageStudio */
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
};