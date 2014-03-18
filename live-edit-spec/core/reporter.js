/* global window */
var JasminumReporter = require("jasminum/reporter");

exports.Reporter = Reporter;
function Reporter() {
    JasminumReporter.apply(this, arguments);
}
Reporter.prototype = Object.create(JasminumReporter.prototype);
Reporter.prototype.constructor = Reporter;

Reporter.prototype.start = function (test) {
    sendToHost("start", {
        type: test.type,
        name: test.name
    });
    return JasminumReporter.prototype.start.apply(this, arguments);
};

Reporter.prototype.end = function (test) {
    sendToHost("end", {
        type: test.type,
        name: test.name,
        passed: this.passed,
        failed: this.failed,
        skipped: this.skipped,
        failedAssertions: this.failedAssertions,
        passedAssertions: this.passedAssertions
    });
    return JasminumReporter.prototype.end.apply(this, arguments);
};

["failAssertion", "failUnaryAssertion", "failBinaryAssertion"]
.forEach(function(methodName) {
    Reporter.prototype[methodName] = function(assertion) {
        var expected,
            actual;
        try {
            expected = JSON.stringify(assertion.expected);
        } catch(ex) {
            expected = "" + assertion.expected;
        }
        try {
            actual = JSON.stringify(assertion.actual);
        } catch(ex) {
            actual = "" + assertion.actual;
        }
        sendToHost("failAssertion", {
            name: this.test.name,
            message: assertion.message,
            expected: expected,
            operator: assertion.operator,
            actual: actual,
            stack: assertion.stack
        });
        return JasminumReporter.prototype[methodName].apply(this, arguments);
    };
});

Reporter.prototype.passAssertion = function () {
    sendToHost("passAssertion");
    return JasminumReporter.prototype.passAssertion.apply(this, arguments);
};

Reporter.prototype.error = function (error) {
    sendToHost("error", {
        stack: error && error.stack ? error.stack : ""
    });
    return JasminumReporter.prototype.error.apply(this, arguments);
};

function sendToHost(type, message) {
    window.parent.postMessage({type: type, data: message}, "*");
}