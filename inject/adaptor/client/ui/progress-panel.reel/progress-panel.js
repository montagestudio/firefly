/**
 * @module ui/progress-panel.reel
 * @requires montage/ui/component
 */
var Component = require("montage/ui/component").Component;

/**
 * @class ProgressPanel
 * @extends Component
 */
exports.ProgressPanel = Component.specialize(/** @lends ProgressPanel# */ {
    constructor: {
        value: function ProgressPanel() {
            this.super();
        }
    },

    message: {
        value: null
    },

    progressMax: {
        value: 100
    },

    progress: {
        value: 0
    },

    progressIsIndeterminite: {
        value: false
    }
});
