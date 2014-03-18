var Promise = require("montage/core/promise").Promise;
var findOwner = require("core/spec-helper").findOwner;

/* global describe, Declarativ */
module.exports = function() {
    var LiveEdit = Declarativ.LiveEdit;
    var mainModuleId = "components/ui/main.reel";
    var result;

    describe("add objects to the owner template", function() {
        it("should change the template declaration when an object is added to an owner", function() {
            var serialization = {
                "newRangeController": {
                    "prototype": "montage/core/range-controller",
                    "properties": {
                        "content": [4, 5, 6]
                    }
                }
            };
            var templateFragment = {
                serialization: JSON.stringify(serialization)
            };
            result = LiveEdit.addTemplateFragmentObjects(mainModuleId, templateFragment);

            return Promise.resolve(result).then(function() {
                var owner = findOwner(mainModuleId);
                var serializationObject = owner._template.getSerialization().getSerializationObject();
                var object = serializationObject.newRangeController;

                expect(object).toEqual(serializationObject.newRangeController);
            });
        });

        it("should change the template declaration when a component is added to an owner", function() {
            var serialization = {
                "newButton": {
                    "prototype": "digit/ui/button.reel",
                    "properties": {
                        "element": {"#": "newButton"}
                    }
                }
            };
            var templateFragment = {
                serialization: JSON.stringify(serialization)
            };
            result = LiveEdit.addTemplateFragmentObjects(mainModuleId, templateFragment);

            return Promise.resolve(result).then(function() {
                var owner = findOwner(mainModuleId);
                var serializationObject = owner._template.getSerialization().getSerializationObject();
                var object = serializationObject.newButton;

                expect(object).toEqual(serializationObject.newButton);
            });
        });
    });

    describe("remove objects from the owner template", function() {
        it("should change the template declaration when an object is removed from the owner", function() {
            result = LiveEdit.deleteObject(mainModuleId, "itemsController");

            return Promise.resolve(result).then(function() {
                var owner = findOwner(mainModuleId);
                var serializationObject = owner._template.getSerialization().getSerializationObject();
                var object = serializationObject.itemsController;

                expect(object).not.toBeDefined();
            });
        });
    });

    describe("change labels in the owner template", function() {
        it("should change the template declaration when an object has its label changed", function() {
            result = LiveEdit.setObjectLabel(mainModuleId, "rangeController", "contentController");

            return Promise.resolve(result).then(function() {
                var owner = findOwner(mainModuleId);
                var serializationObject = owner._template.getSerialization().getSerializationObject();
                var object;

                object = serializationObject.contentController;
                expect(object).toBeDefined();

                object = serializationObject.rangeController;
                expect(object).not.toBeDefined();
            });
        });
    });
};