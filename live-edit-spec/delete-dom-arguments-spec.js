/* global document, describe, Declarativ */
var Promise = require("montage/core/promise").Promise;

module.exports = function() {
    var LiveEdit = Declarativ.LiveEdit;
    var mainModuleId = "arguments/ui/main.reel";
    var result;

    var ATTR_LE_ARG_BEGIN = "data-montage-le-arg-begin";
    var ATTR_LE_ARG_END = "data-montage-le-arg-end";

    describe("live attributes in star arguments", function() {
        it("should update the end attribute when the end boundary element is removed from the star argument range", function() {
            var oldEnd = document.getElementsByClassName("multipleStarArgumentEnd")[0];
            var newEnd = oldEnd.previousElementSibling;

            result = LiveEdit.deleteElement(
                mainModuleId,
                {
                    label: "multipleStarParameter",
                    argumentName: "",
                    cssSelector: ":scope + * + *"
                });

            return Promise.resolve(result).then(function() {
                var attrValue;

                attrValue = newEnd.getAttribute(ATTR_LE_ARG_END) || "";
                expect(attrValue.trim()).toBe("arguments/ui/main.reel,multipleStarParameter");
            });
        });

        it("should update the begin attribute when the being boundary element is removed from the star argument range", function() {
            var oldEnd = document.getElementsByClassName("multipleStarArgumentBegin")[0];
            var newEnd = oldEnd.nextElementSibling;

            result = LiveEdit.deleteElement(
                mainModuleId,
                {
                    label: "multipleStarParameter",
                    argumentName: "",
                    cssSelector: ":scope"
                });

            return Promise.resolve(result).then(function() {
                var attrValue;

                attrValue = newEnd.getAttribute(ATTR_LE_ARG_BEGIN) || "";
                expect(attrValue.trim()).toBe("arguments/ui/main.reel,multipleStarParameter");
            });
        });
    });
};