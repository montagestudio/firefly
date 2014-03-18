var Promise = require("montage/core/promise").Promise;
var findOwner = require("core/spec-helper").findOwner;

/* global describe, Declarativ */
module.exports = function() {
    var LiveEdit = Declarativ.LiveEdit;
    var mainModuleId = "components/ui/main.reel";
    var result;

    describe("bindings in the owner template", function() {
        it("should change the template declaration when a binding is defined on an object", function() {
            result = LiveEdit.setObjectBinding(mainModuleId, "text", {
                propertyName: "value",
                propertyDescriptor: {
                    "<-": "@textField.value"
                }
            });

            return Promise.resolve(result).then(function() {
                var owner = findOwner(mainModuleId);
                var serializationObject = owner._template.getSerialization().getSerializationObject();
                var object = serializationObject.text;

                expect(object.bindings.value).toEqual({
                    "<-": "@textField.value"
                });
            });
        });

        it("should change the template declaration when a binding is deleted from an object", function() {
            result = LiveEdit.deleteObjectBinding(mainModuleId, "textField", "placeholderValue");

            return Promise.resolve(result).then(function() {
                var owner = findOwner(mainModuleId);
                var serializationObject = owner._template.getSerialization().getSerializationObject();
                var object = serializationObject.textField;

                expect(object.bindings.placeholderValue).not.toBeDefined();
            });
        });
    });
};