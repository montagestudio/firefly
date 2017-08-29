var Promise = require("montage/core/promise").Promise;
var findOwner = require("core/spec-helper").findOwner;

/* global describe, MontageStudio */
module.exports = function() {
    var LiveEdit = MontageStudio.LiveEdit;
    var mainModuleId = "components/ui/main.reel";
    var result;

    describe("event listeners in the owner template", function() {
        it("should change the template declaration when an event listener is added to an object", function() {
            result = LiveEdit.addObjectEventListener(mainModuleId, "button", "action", "owner", false);

            return Promise.resolve(result).then(function() {
                var owner = findOwner(mainModuleId);
                var serializationObject = owner._template.getSerialization().getSerializationObject();
                var object = serializationObject.button;
                var listener = object.listeners[object.listeners.length - 1];

                expect(listener).toEqual({
                    type: "action",
                    listener: {"@": "owner"},
                    useCapture: false
                });
            });
        });

        it("should change the template declaration when an event listener is removed from an object", function() {
            result = LiveEdit.removeObjectEventListener(mainModuleId, "itemButton", "longAction", "owner", false);

            return Promise.resolve(result).then(function() {
                var owner = findOwner(mainModuleId);
                var serializationObject = owner._template.getSerialization().getSerializationObject();
                var object = serializationObject.itemButton;

                object.listeners.forEach(function(listener) {
                    expect(listener).not.toEqual({
                        type: "longAction",
                        listener: {"@": "owner"},
                        useCapture: false
                    });
                });
            });
        });
    });
};