/**
 * @module ui/menu.reel
 * @requires montage/ui/component
 */
var Component = require("montage/ui/component").Component;

/**
 * @class Menu
 * @extends Component
 */

//TODO not hardcode so much of this as a mainMenu; it should be able to represent any generic model

exports.Menu = Component.specialize(/** @lends Menu# */ {
    constructor: {
        value: function Menu() {
            this.super();

            this.addPathChangeListener("menuModel", this, "handleMenuModelChange");
        }
    },

    menuModel: {
        value: null
    },

    handleMenuModelChange: {
        value: function (menuModel) {
            if (menuModel) {
                this.undoMenuItemModel = menuModel.menuItemForIdentifier("undo");
                this.redoMenuItemModel = menuModel.menuItemForIdentifier("redo");
            }
        }
    },

    undoMenuItemModel: {
        value: null
    },

    redoMenuItemModel: {
        value: null
    }

});
