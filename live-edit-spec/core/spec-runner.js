/* global window, document */
/**
 * This module is meant to be executed by the montage application part of a
 * test. It should be called when the montage application decides it is ready
 * for the spec.
 */
var Reporter = require("core/reporter").Reporter;
var Suite = require("jasminum");
var Expectation = require("jasminum/expectation");

var LIVE_EDIT_SRC = "../../container/preview/client/live-edit.js";

exports.run = function() {
    var spec = "";
    var queryString = window.location.search.slice(1);
    queryString.split("&").forEach(function(paramString) {
        var param = paramString.split("=");
        if (param[0] === "spec") {
            spec = param[1];
        }
    });

    var liveEditScript = document.createElement("script");
    liveEditScript.src = LIVE_EDIT_SRC;
    document.head.appendChild(liveEditScript);

    var reporter = new Reporter();
    return require.async(spec).then(function(exports) {
        return new Suite().describe(function() {
            exports();
        }).run(reporter).then(function() {
            window.parent.postMessage({type: "done", data: {
                type: reporter.type,
                name: reporter.name,
                passed: reporter.passed,
                failed: reporter.failed,
                skipped: reporter.skipped,
                failedAssertions: reporter.failedAssertions,
                passedAssertions: reporter.passedAssertions
            }}, "*");
        });
    });
};

Expectation.prototype.toBeSomething = function() {
    var isSomething = this.value != null;
    // We reverse the isNot meaning in order to have a message sentence that
    // makes sense.
    var assertion = {
        message: "expected " + this.value + (this.isNot ? "" : " not") + " to be null or undefined",
        stack: getStackTrace()
    };
    // jshint -W018
    if (isSomething === !!this.isNot) {
        // jshint +W018
        this.report.failAssertion(assertion);
    } else {
        this.report.passAssertion(assertion);
    }
};

function getStackTrace() {
    var stack = new Error("").stack;
    if (typeof stack === "string") {
        return stack.replace(/^[^\n]*\n[^\n]\n/, "");
    } else {
        return stack;
    }
}