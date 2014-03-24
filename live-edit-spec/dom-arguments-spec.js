/* global document, describe, Declarativ */
var Promise = require("montage/core/promise").Promise;

module.exports = function() {
    var LiveEdit = Declarativ.LiveEdit;
    var mainModuleId = "arguments/ui/main.reel";
    var result;

    var ATTR_LE_ARG_BEGIN = "data-montage-le-arg-begin";
    var ATTR_LE_ARG_END = "data-montage-le-arg-end";

    describe("live attributes in star arguments", function() {
        it("should update the begin attribute when a new element is added to the beginning of the star argument boundary where the star argument range is composed by a single element", function() {
            var templateFragment = {
                html: '<div class="newSingleStarArgumentBegin"></div>'
            };
            result = LiveEdit.addTemplateFragment(
                mainModuleId,
                {
                    label: "singleStarParameterBegin",
                    argumentName: "",
                    cssSelector: ":scope"
                },
                "before",
                templateFragment);

            return Promise.resolve(result).then(function() {
                var oldBegin = document.getElementsByClassName("singleStarArgumentBegin")[0];
                var newBegin = document.getElementsByClassName("newSingleStarArgumentBegin")[0];
                var attrValue;

                attrValue = newBegin.getAttribute(ATTR_LE_ARG_BEGIN) || "";
                expect(attrValue.trim()).toBe("arguments/ui/main.reel,singleStarParameterBegin");

                attrValue = oldBegin.getAttribute(ATTR_LE_ARG_BEGIN) || "";
                expect(attrValue.trim()).toBe("");
            });
        });

        it("should update the end attribute when a new element is added to the end of the star argument boundary where the star argument range is composed by a single element", function() {
            var templateFragment = {
                html: '<div class="newSingleStarArgumentEnd"></div>'
            };
            result = LiveEdit.addTemplateFragment(
                mainModuleId,
                {
                    label: "singleStarParameterEnd",
                    argumentName: "",
                    cssSelector: ":scope"
                },
                "after",
                templateFragment);

            return Promise.resolve(result).then(function() {
                var oldEnd = document.getElementsByClassName("singleStarArgumentEnd")[0];
                var newEnd = document.getElementsByClassName("newSingleStarArgumentEnd")[0];
                var attrValue;

                attrValue = newEnd.getAttribute(ATTR_LE_ARG_END) || "";
                expect(attrValue.trim()).toBe("arguments/ui/main.reel,singleStarParameterEnd");

                attrValue = oldEnd.getAttribute(ATTR_LE_ARG_END) || "";
                expect(attrValue.trim()).toBe("");
            });
        });

        it("should update the end attribute when new elements are added to the end of the star argument boundary", function() {
            var templateFragment = {
                html: '<p></p><p></p><p class="newMultipleStarArgumentEnd"></p>'
            };
            result = LiveEdit.addTemplateFragment(
                mainModuleId,
                {
                    label: "multipleStarParameter",
                    argumentName: "",
                    cssSelector: ":scope + * + *"
                },
                "after",
                templateFragment);

            return Promise.resolve(result).then(function() {
                var oldEnd = document.getElementsByClassName("multipleStarArgumentEnd")[0];
                var newEnd = document.getElementsByClassName("newMultipleStarArgumentEnd")[0];
                var attrValue;

                attrValue = newEnd.getAttribute(ATTR_LE_ARG_END) || "";
                expect(attrValue.trim()).toBe("arguments/ui/main.reel,multipleStarParameter");

                attrValue = oldEnd.getAttribute(ATTR_LE_ARG_END) || "";
                expect(attrValue.trim()).toBe("");
            });
        });

        it("should update the begin attribute when new elements are added to the beginning of the star argument boundary", function() {
            var templateFragment = {
                html: '<p class="newMultipleStarArgumentBegin"></p><p></p><p></p>'
            };
            result = LiveEdit.addTemplateFragment(
                mainModuleId,
                {
                    label: "multipleStarParameter",
                    argumentName: "",
                    cssSelector: ":scope"
                },
                "before",
                templateFragment);

            return Promise.resolve(result).then(function() {
                var oldBegin = document.getElementsByClassName("multipleStarArgumentBegin")[0];
                var newBegin = document.getElementsByClassName("newMultipleStarArgumentBegin")[0];
                var attrValue;

                attrValue = newBegin.getAttribute(ATTR_LE_ARG_BEGIN) || "";
                expect(attrValue.trim()).toBe("arguments/ui/main.reel,multipleStarParameter");

                attrValue = oldBegin.getAttribute(ATTR_LE_ARG_BEGIN) || "";
                expect(attrValue.trim()).toBe("");
            });
        });
    });
};