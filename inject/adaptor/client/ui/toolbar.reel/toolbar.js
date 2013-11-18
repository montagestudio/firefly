/**
 * @module ui/toolbar.reel
 * @requires montage/ui/component
 */
var Component = require("montage/ui/component").Component;
var userController = require("adaptor/client/core/user-controller").userController;
/**
 * @class Toolbar
 * @extends Component
 */
exports.Toolbar = Component.specialize(/** @lends Toolbar# */ {
    constructor: {
        value: function Toolbar() {
            var self = this;

            this.super();

            this.addPathChangeListener("mainMenu", this, "handleMainMenuChange");
            userController.then(function(userController) {
                self.userController = userController;
            });
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

    handleNewButtonAction: {
        value: function (event) {
            this.environmentBridge.openHttpUrl(window.location.origin + "/projects#new");
        }
    },

    undoMenuItemModel: {
        value: null
    },

    redoMenuItemModel: {
        value: null
    },

    userController: {
        value: null
    }
});
