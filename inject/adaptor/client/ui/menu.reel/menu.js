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

    activeMenuItem: {
        value: null
    },

    activePath: {
        value: []
    },

    constructor: {
        value: function Menu() {
            this.super();
        }
    }
});
