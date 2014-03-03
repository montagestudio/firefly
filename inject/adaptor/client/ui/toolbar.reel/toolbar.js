/*global window */
/**
 * @module ui/toolbar.reel
 * @requires montage/ui/component
 */
var Component = require("montage/ui/component").Component;
var UserController = require("adaptor/client/core/user-controller").UserController;
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
            self.userController = new UserController().init();
            this.addPathChangeListener("environmentBridge", function(value) {
                if (value) {
                    value.repositoryController.getRepositoryUrl()
                    .then(function(url) {
                        self.sourceUrl = url;
                    }).done();
                }
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
                this.deleteMenuItemModel = menuModel.menuItemForIdentifier("delete");
            }
        }
    },

    handleNewButtonAction: {
        value: function (event) {
            this.environmentBridge.openHttpUrl(window.location.origin + "/projects#new");
        }
    },

    handleOpenButtonAction: {
        value: function (event) {
            this.environmentBridge.openHttpUrl(window.location.origin + "/projects");
        }
    },

    handleSourceButtonAction: {
        value: function() {
            window.open(this.sourceUrl);
        }
    },

    handleLogoutButtonAction: {
        value: function() {
            window.location.href = this.environmentBridge.logoutUrl;
        }
    },

    sourceUrl: {
        value: null
    },

    undoMenuItemModel: {
        value: null
    },

    redoMenuItemModel: {
        value: null
    },

    deleteMenuItemModel: {
        value: null
    },

    userController: {
        value: null
    }
});
