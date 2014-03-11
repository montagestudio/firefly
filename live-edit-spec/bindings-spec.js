var Promise = require("montage/core/promise").Promise;
var findObject = require("core/spec-helper").findObject;
var findObjects = require("core/spec-helper").findObjects;

/* global describe, Declarativ */
module.exports = function() {
    var LiveEdit = Declarativ.LiveEdit;
    var mainModuleId = "components/ui/main.reel";
    var result;

    describe("bindings", function() {
        it("should define a binding on an object", function() {
            result = LiveEdit.setObjectBinding(mainModuleId, "text", {
                propertyName: "value",
                propertyDescriptor: {
                    "<-": "@textField.value"
                }
            });

            return Promise.resolve(result).then(function() {
                var text = findObject(mainModuleId, "text");
                var binding = text.getBinding("value");

                expect(binding).toBeDefined();
                expect(binding["<-"]).toBe("@textField.value");
            });
        });

        it("should define a binding on all instances of an object", function() {
            result = LiveEdit.setObjectBinding(mainModuleId, "itemText", {
                propertyName: "value",
                propertyDescriptor: {
                    "<-": "@textField.value"
                }
            });

            return Promise.resolve(result).then(function() {
                var items = findObjects(mainModuleId, "itemText");

                items.forEach(function(item) {
                    var binding = item.getBinding("value");
                    expect(binding).toBeDefined();
                    expect(binding["<-"]).toBe("@textField.value");
                });
            });
        });

        it("should delete a binding on an object", function() {
            result = LiveEdit.deleteObjectBinding(mainModuleId, "textField", "placeholderValue");

            return Promise.resolve(result).then(function() {
                var text = findObject(mainModuleId, "textField");
                var binding = text.getBinding("placeholderValue");

                expect(binding).not.toBeDefined();
            });
        });

        it("should delete a binding on all instances of an object", function() {
            result = LiveEdit.deleteObjectBinding(mainModuleId, "itemTextField", "placeholderValue");

            return Promise.resolve(result).then(function() {
                var items = findObjects(mainModuleId, "itemTextField");

                items.forEach(function(item) {
                    var binding = item.getBinding("placeholderValue");
                    expect(binding).not.toBeDefined();
                });
            });
        });
    });
};