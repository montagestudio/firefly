var Promise = require("montage/core/promise").Promise;
var findObject = require("core/spec-helper").findObject;
var findObjects = require("core/spec-helper").findObjects;

/* global describe, MontageStudio */
module.exports = function() {
    var LiveEdit = MontageStudio.LiveEdit;
    var mainModuleId = "components/ui/main.reel";
    var result;

    describe("properties", function() {
        it("should set the property of an object", function() {
            var value = "a random number: " + Math.random();

            result = LiveEdit.setObjectProperty(mainModuleId, "text", "value", value);

            return Promise.resolve(result).then(function() {
                var text = findObject(mainModuleId, "text");

                expect(text.value).toBe(value);
            });
        });

        it("should set the property of an object to another object", function() {
            result = LiveEdit.setObjectProperty(mainModuleId, "repetition", "contentController", {label: "rangeController"}, "object");

            return Promise.resolve(result).then(function() {
                var text = findObject(mainModuleId, "repetition");
                var rangeController = findObject(mainModuleId, "rangeController");

                expect(text.contentController).toBe(rangeController);
            });
        });

        it("should set the property of all instances of an object", function() {
            var value = "a random number: " + Math.random();

            result = LiveEdit.setObjectProperty(mainModuleId, "itemText", "value", value);

            return Promise.resolve(result).then(function() {
                var items = findObjects(mainModuleId, "itemText");

                expect(items.length).toBe(3); // sanity check
                items.forEach(function(item) {
                    expect(item.value).toBe(value);
                });
            });
        });

        it("should set the property of all instances of an object to another object", function() {
            result = LiveEdit.setObjectProperty(mainModuleId, "subItems", "contentController", {label: "rangeController"}, "object");

            return Promise.resolve(result).then(function() {
                var items = findObjects(mainModuleId, "subItems");
                var rangeController = findObject(mainModuleId, "rangeController");

                expect(items.length).toBe(3); // sanity check
                items.forEach(function(item) {
                    expect(item.contentController).toBe(rangeController);
                });
            });
        });
    });
};