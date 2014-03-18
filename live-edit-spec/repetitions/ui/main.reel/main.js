/**
 * @module ui/main.reel
 * @requires montage/ui/component
 */
var Component = require("montage/ui/component").Component;
var SpecRunner = require("core/spec-runner");

/**
 * @class Main
 * @extends Component
 */
exports.Main = Component.specialize(/** @lends Main# */ {
    constructor: {
        value: function Main() {
            this.super();
        }
    },

    enterDocument: {
        value: function(firstTime) {
            if (firstTime) {
                SpecRunner.run().done();
            }
        }
    }
});
