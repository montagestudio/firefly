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
    },

    // To prevent dispatching events from itself, preserve the
    // activeTarget
    // TODO while clever, we might need to actually accept activeTarget for usability
    // and instead store whom to dispatch from once we've "stolen" the activeTarget status
    acceptsActiveTarget: {
        get: function () {
            this.nextTarget = this.eventManager.activeTarget;
            return false;
        }
    }

});
