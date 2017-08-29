var Promise = require("montage/core/promise").Promise;
var findOwner = require("core/spec-helper").findOwner;

/* global describe, MontageStudio */
module.exports = function() {
    var LiveEdit = MontageStudio.LiveEdit;
    var mainModuleId = "components/ui/main.reel";
    var result;

    describe("properties in the owner template", function() {
        it("should change the template declaration when a property of an object is set", function() {
            var value = "a random number: " + Math.random();

            result = LiveEdit.setObjectProperty(mainModuleId, "text", "value", value);

            return Promise.resolve(result).then(function() {
                var owner = findOwner(mainModuleId);
                var serializationObject = owner._template.getSerialization().getSerializationObject();
                var object = serializationObject.text;

                expect(object.properties.value).toBe(value);
            });
        });

        it("should change the template declaration when a property of an object is set to another object", function() {
            result = LiveEdit.setObjectProperty(mainModuleId, "repetition", "contentController", {label: "rangeController"}, "object");

            return Promise.resolve(result).then(function() {
                var owner = findOwner(mainModuleId);
                var serializationObject = owner._template.getSerialization().getSerializationObject();
                var object = serializationObject.repetition;

                expect(object.properties.contentController).toEqual({"@": "rangeController"});
            });
        });
    });
};