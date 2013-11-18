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

            this.addPathChangeListener("mainMenu", this, "handleMainMenuChange");
        }
    },

    mainMenu: {
        value: null
    },

    handleMainMenuChange: {
        value: function (menuModel) {
            if (menuModel) {
                this.undoMenuItemModel = menuModel.menuItemForIdentifier("undo");
                this.redoMenuItemModel = menuModel.menuItemForIdentifier("redo");
                this.saveMenuItemModel = menuModel.menuItemForIdentifier("save");
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
