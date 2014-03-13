/**
 * @module ui/menu.reel
 * @requires montage/ui/component
 */
var Component = require("montage/ui/component").Component;

/**
 * @class Menu
 * @extends Component
 */

exports.Menu = Component.specialize(/** @lends Menu# */ {

    activePath: {
        value: []
    },

    constructor: {
        value: function Menu() {
            this.super();
        }
    }
});
