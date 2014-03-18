/**
 * @module ui/empty.reel
 * @requires montage/ui/component
 */
var Component = require("montage/ui/component").Component;

/**
 * @class Empty
 * @extends Component
 */
exports.Empty = Component.specialize(/** @lends Empty# */ {
    constructor: {
        value: function Empty() {
            this.super();
        }
    }
});
