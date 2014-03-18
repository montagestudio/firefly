/* global Declarativ */
var Promise = require("montage/core/promise").Promise;
var findObject = require("core/spec-helper").findObject;
var findObjects = require("core/spec-helper").findObjects;
var hasEventListener = require("core/spec-helper").hasEventListener;

module.exports = function() {
    var LiveEdit = Declarativ.LiveEdit;
    var mainModuleId = "components/ui/main.reel";
    var result;

    describe("event listeners", function() {
        it("should add an event listener to an object", function() {
            result = LiveEdit.addObjectEventListener(mainModuleId, "button", "action", "owner", false);

            return Promise.resolve(result).then(function() {
                var button = findObject(mainModuleId, "button");
                var owner = findObject(mainModuleId, "owner");

                expect(hasEventListener(button, "action", owner, false)).toBe(true);
            });
        });

        it("should define a binding on all instances of an object", function() {
            result = LiveEdit.addObjectEventListener(mainModuleId, "itemButton", "action", "owner", false);

            return Promise.resolve(result).then(function() {
                var items = findObjects(mainModuleId, "itemButton");
                var owner = findObject(mainModuleId, "owner");

                items.forEach(function(item) {
                    expect(hasEventListener(item, "action", owner, false)).toBe(true);
                });
            });
        });

        it("should delete a binding on an object", function() {
            result = LiveEdit.removeObjectEventListener(mainModuleId, "button", "longAction", "owner", false);

            return Promise.resolve(result).then(function() {
                var button = findObject(mainModuleId, "button");
                var owner = findObject(mainModuleId, "owner");

                expect(hasEventListener(button, "longAction", owner, false)).toBe(false);
            });
        });

        it("should delete a binding on all instances of an object", function() {
            result = LiveEdit.removeObjectEventListener(mainModuleId, "itemButton", "longAction", "owner", false);

            return Promise.resolve(result).then(function() {
                var items = findObjects(mainModuleId, "itemButton");
                var owner = findObject(mainModuleId, "owner");

                items.forEach(function(item) {
                    expect(hasEventListener(item, "longAction", owner, false)).toBe(false);
                });
            });
        });
    });
};