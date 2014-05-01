var findOwner = require("core/spec-helper").findOwner;

/* global describe, document, Declarativ */
module.exports = function() {
    var MontageElement = Declarativ.LiveEdit.MontageElement;
    var mainModuleId = "components/ui/main.reel";
    var owner = findOwner(mainModuleId);

    describe("owner property", function() {
        it("should report the right owner when montage element represents the owner", function() {
            var montageElement = new MontageElement(owner.element, mainModuleId, "owner");
            expect(montageElement.owner).toBe(owner);
        });

        it("should report the right owner when it represents an element that is a child of the owner", function() {
            var montageElement = new MontageElement(owner.element.firstChild, mainModuleId, "owner");
            expect(montageElement.owner).toBe(owner);
        });

        it("should report the right owner when it represents a component element that is owned by the owner", function() {
            var element = document.querySelector("*[data-montage-id='itemText']");

            var montageElement = new MontageElement(element, mainModuleId, "itemText");
            expect(montageElement.owner).toBe(owner);
        });
    });
};