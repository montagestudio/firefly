/**
 * @module ui/menu-item.reel
 * @requires montage/ui/component
 */
var Component = require("montage/ui/component").Component;

/**
 * @class MenuItem
 * @extends Component
 */
exports.MenuItem = Component.specialize(/** @lends MenuItem# */ {
    constructor: {
        value: function MenuItem() {
            this.super();
        }
    },

    menuItemModel: {
        value: null
    },

    //TODO handle menuValidate event

    handleMenuButtonAction: {
        value: function () {
            if (this.menuItemModel) {
                this.menuItemModel.dispatchMenuEvent("menuAction");
            }
        }
    }

});
