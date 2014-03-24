/* global document, describe, Declarativ */
var Promise = require("montage/core/promise").Promise;

module.exports = function() {
    var LiveEdit = Declarativ.LiveEdit;
    var mainModuleId = "elements/ui/main.reel";
    var result;

    describe("remove elements", function() {
        it("should remove an element", function() {
            result = LiveEdit.deleteElement(
                mainModuleId,
                {
                    label: "owner",
                    argumentName: "",
                    cssSelector: ":scope > :nth-child(1) > :nth-child(1)"
                });

            return Promise.resolve(result).then(function() {
                var element = document.getElementsByClassName("beforeFirst")[0];
                expect(element).not.toBeSomething();
            });
        });

        it("should remove all instances of the same element", function() {
            result = LiveEdit.deleteElement(
                mainModuleId,
                {
                    label: "items",
                    argumentName: "",
                    cssSelector: ":scope > :nth-child(1) > :nth-child(1)"
                });

            return Promise.resolve(result).then(function() {
                var elements = document.getElementsByClassName("itemBeforeFirst");
                expect(elements.length).toBe(0);
            });
        });
    });
};