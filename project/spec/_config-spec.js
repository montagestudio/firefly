// Disable logging in the tests
function noop() {}
require("../../common/logging").from = function () { return noop; };

if (!process.env.runSlowSpecs) {
    var SlowSpecReporter = function () {
        this.MAX_TIME = 100;
        this.specs = [];
    };

    SlowSpecReporter.prototype = {
        reportSpecStarting: function (spec) {
            spec.startTime = Date.now();
        },

        reportSpecResults: function (spec) {
            if ((Date.now() - spec.startTime) > this.MAX_TIME) {
                spec.time = Date.now() - spec.startTime;
                this.specs.push(spec);
            }
        },

        reportRunnerResults: function (runner) {
            if (this.specs.length) {
                this.log("These specs are slow, wrap them in `if (process.env.runSlowSpecs)`:");
                this.specs.sort(function (a, b) {
                    return b.time - a.time;
                }).forEach(function (spec) {
                    this.log(spec.time + "ms\t" + spec.suite.getFullName() + " " + spec.description);
                }, this);
                this.log("\n");
            }
        },

        log: function(str) {
            var console = jasmine.getGlobal().console;
            if (console && console.log) {
                console.log(str);
            }
        }
    };

    jasmine.getEnv().addReporter(new SlowSpecReporter());
}
