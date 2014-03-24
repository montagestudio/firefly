/* global document */
var Promise = require("montage/core/promise").Promise;
var getMontageId = require("core/spec-helper").getMontageId;

/* global describe, Declarativ */
module.exports = function() {
    var LiveEdit = Declarativ.LiveEdit;
    var mainModuleId = "elements/ui/main.reel";
    var result;

    describe("add elements", function() {
        describe("before an anchor node", function() {
            it("should add new element to an owner before an anchor node", function() {
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
                    var newElement = document.getElementsByClassName("beforeAnchor")[0];

                    expect(newElement).toBeDefined();
                    expect(getMontageId(newElement.previousElementSibling)).toBe("beforeFirst");
                    expect(getMontageId(newElement.nextElementSibling)).toBe("beforeLast");
                });
            });

            it("should add new elements to an owner after each instance of the anchor node", function() {
                var templateFragment = {
                    html: '<div class="itemBeforeAnchor"></div>'
                };
                result = LiveEdit.addTemplateFragment(
                    mainModuleId,
                    {
                        label: "items",
                        argumentName: "",
                        cssSelector: ":scope > :nth-child(1) > :nth-child(2)"
                    },
                    "before",
                    templateFragment);

                return Promise.resolve(result).then(function() {
                    var newElements = document.getElementsByClassName("itemBeforeAnchor");

                    expect(newElements.length).toBe(3);
                    Array.prototype.forEach.call(newElements, function(newElement, ix) {
                        expect(getMontageId(newElement.previousElementSibling)).toBe("itemBeforeFirst");
                        expect(getMontageId(newElement.nextElementSibling)).toBe("itemBeforeLast");
                    });
                });
            });
        });

        describe("after an anchor node", function() {
            it("should add new element to an owner after an anchor node", function() {
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
                    var newElement = document.getElementsByClassName("afterAnchor")[0];

                    expect(newElement).toBeDefined();
                    expect(getMontageId(newElement.previousElementSibling)).toBe("afterFirst");
                    expect(getMontageId(newElement.nextElementSibling)).toBe("afterLast");
                });
            });

            it("should add new elements to an owner before each instance of the anchor node", function() {
                var templateFragment = {
                    html: '<div class="itemAfterAnchor"></div>'
                };
                result = LiveEdit.addTemplateFragment(
                    mainModuleId,
                    {
                        label: "items",
                        argumentName: "",
                        cssSelector: ":scope > :nth-child(2) > :nth-child(1)"
                    },
                    "after",
                    templateFragment);

                return Promise.resolve(result).then(function() {
                    var newElements = document.getElementsByClassName("itemAfterAnchor");

                    expect(newElements.length).toBe(3);
                    Array.prototype.forEach.call(newElements, function(newElement, ix) {
                        expect(getMontageId(newElement.previousElementSibling)).toBe("itemAfterFirst");
                        expect(getMontageId(newElement.nextElementSibling)).toBe("itemAfterLast");
                    });
                });
            });
        });

        describe("append to an anchor node", function() {
            it("should add a new element to an owner by appending to an anchor node", function() {
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
                    var newElement = document.getElementsByClassName("appendAnchor")[0];

                    expect(newElement).toBeDefined();
                    expect(getMontageId(newElement.previousElementSibling)).toBe("appendLast");
                    expect(newElement.nextElementSibling).toBe(null);
                });
            });

            it("should add new elements to an owner by appending to all instances of the anchor node", function() {
                var templateFragment = {
                    html: '<div class="itemAppendAnchor"></div>'
                };
                result = LiveEdit.addTemplateFragment(
                    mainModuleId,
                    {
                        label: "items",
                        argumentName: "",
                        cssSelector: ":scope > :nth-child(3)"
                    },
                    "append",
                    templateFragment);

                return Promise.resolve(result).then(function() {
                    var newElements = document.getElementsByClassName("itemAppendAnchor");

                    expect(newElements.length).toBe(3);
                    Array.prototype.forEach.call(newElements, function(newElement, ix) {
                        expect(getMontageId(newElement.previousElementSibling)).toBe("itemAppendLast");
                        expect(newElement.nextElementSibling).toBe(null);
                    });
                });
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
                var element = document.querySelector("*[data-montage-id='newId']");
                expect(element).toBeSomething();
            });
        });
    });
};