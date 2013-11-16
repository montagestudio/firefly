/**
 * @module ui/toolbar.reel
 * @requires montage/ui/component
 */
var Component = require("montage/ui/component").Component;

/**
 * @class Toolbar
 * @extends Component
 */
exports.Toolbar = Component.specialize(/** @lends Toolbar# */ {
    constructor: {
        value: function Toolbar() {
            this.super();
        }
    },

    undoMenuItemModel: {
        value: null
    },

    redoMenuItemModel: {
        value: null
    }
});
