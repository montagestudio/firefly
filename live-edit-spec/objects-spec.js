var Promise = require("montage/core/promise").Promise;
var findObject = require("core/spec-helper").findObject;
var findObjects = require("core/spec-helper").findObjects;

/* global describe, MontageStudio */
module.exports = function() {
    var LiveEdit = MontageStudio.LiveEdit;
    var mainModuleId = "components/ui/main.reel";
    var result;

    describe("adding objects", function() {
        it("should add new objects to an owner", function() {
            var templateFragment = {
                serialization: JSON.stringify({
                    "newRangeController": {
                        "prototype": "montage/core/range-controller",
                        "properties": {
                            "content": [4, 5, 6]
                        }
                    }
                })
            };
            result = LiveEdit.addTemplateFragmentObjects(mainModuleId, templateFragment);

            return Promise.resolve(result).then(function() {
                var object = findObject(mainModuleId, "newRangeController");

                expect(object).toBeDefined();
            });
        });

        it("should add new objects to all instances of an owner", function() {
            var templateFragment = {
                serialization: JSON.stringify({
                    "newRangeController": {
                        "prototype": "montage/core/range-controller",
                        "properties": {
                            "content": [4, 5, 6]
                        }
                    }
                })
            };
            result = LiveEdit.addTemplateFragmentObjects("ui/empty.reel", templateFragment);

            return Promise.resolve(result).then(function() {
                var expectedLength = findObjects("ui/empty.reel", "owner").length;
                var items = findObjects("ui/empty.reel", "newRangeController");

                expect(items.length).toBe(expectedLength);
            });
        });

        it("should add new components to an owner", function() {
            var templateFragment = {
                serialization: JSON.stringify({
                    "newButton": {
                        "prototype": "digit/ui/button.reel",
                        "properties": {
                            "element": {"#": "newButton"}
                        }
                    }
                })
            };
            result = LiveEdit.addTemplateFragmentObjects(mainModuleId, templateFragment);

            return Promise.resolve(result).then(function() {
                var component = findObject(mainModuleId, "newButton");

                expect(component).toBeDefined();
            });
        });
    });

    describe("deleting objects", function() {
        it("should delete an object", function() {
            result = LiveEdit.deleteObject(mainModuleId, "rangeController");

            return Promise.resolve(result).then(function() {
                var object = findObject(mainModuleId, "rangeController");
                expect(object).not.toBeDefined();
            });
        });
    });

    describe("changing labels", function() {
        it("should rename the label of an object", function() {
            var rangeController = findObject(mainModuleId, "rangeController");
            result = LiveEdit.setObjectLabel(mainModuleId, "rangeController", "contentController");

            return Promise.resolve(result).then(function() {
                var object;

                object = findObject(mainModuleId, "contentController");
                expect(object).toBe(rangeController);

                object = findObject(mainModuleId, "rangeController");
                expect(object).not.toBeDefined();
            });
        });
    });
};