var Promise = require("montage/core/promise").Promise;
var findObject = require("core/spec-helper").findObject;

/* global describe, Declarativ */
module.exports = function() {
    var LiveEdit = Declarativ.LiveEdit;
    var mainModuleId = "repetitions/ui/main.reel";
    var result;

    describe("repetition iteration template", function() {
        it("should set the iteration template to dirty when adding an element", function() {
            var templateFragment = {
                html: '<div class="newElement"></div>'
            };
            result = LiveEdit.addTemplateFragment(
                mainModuleId,
                {
                    label: "flowers",
                    argumentName: "",
                    cssSelector: ":scope"
                },
                "append",
                templateFragment);

            return Promise.resolve(result).then(function() {
                var repetition = findObject(mainModuleId, "flowers");

                expect(repetition._iterationTemplate.isDirty).toBe(true);

                // Other repetitions shouldn't be affected:
                var repetitions = [
                    findObject(mainModuleId, "animals"),
                    findObject(mainModuleId, "felines"),
                    findObject(mainModuleId, "cats")
                ];
                repetitions.forEach(function(repetition) {
                    expect(repetition._iterationTemplate.isDirty).toBe(false);
                });
            });
        });

        it("should set the all iteration templates from the owner to dirty when adding an element to an inner repetition", function() {
            var templateFragment = {
                html: '<div class="newElement"></div>'
            };
            result = LiveEdit.addTemplateFragment(
                mainModuleId,
                {
                    label: "cats",
                    argumentName: "",
                    cssSelector: ":scope"
                },
                "append",
                templateFragment);

            return Promise.resolve(result).then(function() {
                var repetitions = [
                    findObject(mainModuleId, "animals"),
                    findObject(mainModuleId, "felines"),
                    findObject(mainModuleId, "cats")
                ];
                repetitions.forEach(function(repetition) {
                    expect(repetition._iterationTemplate.isDirty).toBe(true);
                });
            });
        });

        it("should set the iteration template to dirty when adding an element to an empty repetition", function() {
            var templateFragment = {
                html: '<div class="newElement"></div>'
            };
            result = LiveEdit.addTemplateFragment(
                mainModuleId,
                {
                    label: "contentless",
                    argumentName: "",
                    cssSelector: ":scope"
                },
                "append",
                templateFragment);

            return Promise.resolve(result).then(function() {
                var repetition = findObject(mainModuleId, "contentless");

                expect(repetition._iterationTemplate.isDirty).toBe(true);
            });
        });

        it("should set the iteration template to dirty when setting an element attribute", function() {
            result = LiveEdit.setElementAttribute(
                mainModuleId,
                {
                    label: "flowers",
                    argumentName: "",
                    cssSelector: ":scope"
                },
                "class",
                "item");

            return Promise.resolve(result).then(function() {
                var repetition = findObject(mainModuleId, "flowers");

                expect(repetition._iterationTemplate.isDirty).toBe(true);
            });
        });

        it("should set the iteration template to dirty when defining a binding", function() {
            result = LiveEdit.setObjectBinding(mainModuleId, "flower", {
                propertyName: "value",
                propertyDescriptor: {
                    "<-": "'tulip'"
                }
            });

            return Promise.resolve(result).then(function() {
                var repetition = findObject(mainModuleId, "flowers");

                expect(repetition._iterationTemplate.isDirty).toBe(true);
            });
        });

        it("should set the iteration template to dirty when deleting a binding", function() {
            result = LiveEdit.deleteObjectBinding(mainModuleId, "flower", "label");

            return Promise.resolve(result).then(function() {
                var repetition = findObject(mainModuleId, "flowers");

                expect(repetition._iterationTemplate.isDirty).toBe(true);
            });
        });

        it("should set the iteration template to dirty when adding an event listener", function() {
            result = LiveEdit.addObjectEventListener(mainModuleId, "flower", "action", "owner", false);

            return Promise.resolve(result).then(function() {
                var repetition = findObject(mainModuleId, "flowers");

                expect(repetition._iterationTemplate.isDirty).toBe(true);
            });
        });

        it("should set the iteration template to dirty when removing an event listener", function() {
            result = LiveEdit.removeObjectEventListener(mainModuleId, "flower", "longAction", "owner", false);

            return Promise.resolve(result).then(function() {
                var repetition = findObject(mainModuleId, "flowers");

                expect(repetition._iterationTemplate.isDirty).toBe(true);
            });
        });
    });
};