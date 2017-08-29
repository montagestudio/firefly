var Promise = require("montage/core/promise").Promise;
var findOwner = require("core/spec-helper").findOwner;
var getMontageId = require("core/spec-helper").getMontageId;

/* global describe, MontageStudio */
module.exports = function() {
    var LiveEdit = MontageStudio.LiveEdit;
    var mainModuleId = "elements/ui/main.reel";
    var result;

    describe("elements in the owner template", function() {
        it("should change the template markup when an element is added before an anchor", function() {
            var templateFragment = {
                html: '<div class="beforeAnchor"></div>'
            };
            result = LiveEdit.addTemplateFragment(
                mainModuleId,
                {
                    label: "owner",
                    argumentName: "",
                    cssSelector: ":scope > :nth-child(1) > :nth-child(2)"
                },
                "before",
                templateFragment);

            return Promise.resolve(result).then(function() {
                var owner = findOwner(mainModuleId);
                var document = owner._template.document;

                var element = document.getElementsByClassName("beforeAnchor")[0];

                expect(getMontageId(element.previousElementSibling)).toBe("anchor1");
                expect(getMontageId(element.nextElementSibling)).toBe("anchor2");
            });
        });

        it("should change the template markup when an element is added after an anchor", function() {
            var templateFragment = {
                html: '<div class="afterAnchor"></div>'
            };
            result = LiveEdit.addTemplateFragment(
                mainModuleId,
                {
                    label: "owner",
                    argumentName: "",
                    cssSelector: ":scope > :nth-child(2) > :nth-child(1)"
                },
                "after",
                templateFragment);

            return Promise.resolve(result).then(function() {
                var owner = findOwner(mainModuleId);
                var document = owner._template.document;
                var element = document.getElementsByClassName("afterAnchor")[0];

                expect(getMontageId(element.previousElementSibling)).toBe("anchor3");
                expect(getMontageId(element.nextElementSibling)).toBe("anchor4");
            });
        });

        it("should change the template markup when an element is appended to an anchor", function() {
            var templateFragment = {
                html: '<div class="appendAnchor"></div>'
            };
            result = LiveEdit.addTemplateFragment(
                mainModuleId,
                {
                    label: "owner",
                    argumentName: "",
                    cssSelector: ":scope > :nth-child(3)"
                },
                "append",
                templateFragment);

            return Promise.resolve(result).then(function() {
                var owner = findOwner(mainModuleId);
                var document = owner._template.document;
                var element = document.getElementsByClassName("appendAnchor")[0];

                expect(getMontageId(element.previousElementSibling)).toBe("anchor5");
                expect(getMontageId(element.nextElementSibling)).toBe(null);
            });
        });

        it("should set an attribute", function() {
            result = LiveEdit.setElementAttribute(
                mainModuleId,
                {
                    label: "owner",
                    argumentName: "",
                    cssSelector: ":scope > :nth-child(5)"
                },
                "data-montage-id",
                "newId"
            );

            return Promise.resolve(result).then(function() {
                var owner = findOwner(mainModuleId);
                var document = owner._template.document;
                var element = document.querySelector("*[data-montage-id='newId']");

                expect(element).toBeSomething();
            });
        });
    });
};