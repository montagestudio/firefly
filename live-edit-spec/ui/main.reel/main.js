/* global window*/
/**
 * @module ui/main.reel
 * @requires montage/ui/component
 */
var Component = require("montage/ui/component").Component;
var Promise = require("montage/core/promise").Promise;

/**
 * @class Main
 * @extends Component
 */
exports.Main = Component.specialize(/** @lends Main# */ {
    constructor: {
        value: function Main() {
            this.super();
            this.tests = require("../../all");
        }
    },

    iframe: {
        value: null
    },

    templateDidLoad: {
        value: function() {
            var self = this;
            var runTestsChainPromise = Promise.resolve();

            this.tests.forEach(function(test) {
                test.isRunning = false;
                test.isDone = false;
                runTestsChainPromise = runTestsChainPromise.then(function() {
                    return self.runTest(test);
                });
            }, this);
            runTestsChainPromise.done();
        }
    },

    runTest: {
        value: function(test) {
            var deferred = Promise.defer();
            var iframe = this.iframe;

            test.passed = 0;
            test.failed = 0;
            test.skipped = 0;
            test.isRunning = true;
            test.failures = [];
            test.url = test.app + "?spec=" + test.spec;

            iframe.src = test.url;

            window.addEventListener("message", function onmessage(event) {
                var message = event.data;

                if (message.type === "done") {
                    window.removeEventListener("message", onmessage, false);
                    test.passed = message.data.passed;
                    test.failed = message.data.failed;
                    test.skipped = message.data.skipped;
                    test.isRunning = false;
                    test.isDone = true;
                    deferred.resolve();
                } else if (message.type === "failAssertion") {
                    test.failures.push(message.data);
                } else if (message.type === "error") {
                    test.failures.push(message.data);
                }
            }, false);

            return deferred.promise;
        }
    }
});
