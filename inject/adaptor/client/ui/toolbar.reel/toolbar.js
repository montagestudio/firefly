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

            self.userController = new UserController().init();
            this.addPathChangeListener("environmentBridge", function(bridge) {
                if (bridge) {
                    self.mainMenu = bridge.mainMenu;

                    bridge.userController.getUser()
                        .then(function (user) {
                            self.user = user;
                        }).done();

                    bridge.repositoryController.getRepositoryUrl()
                    .then(function(url) {
                        self.sourceUrl = url;
                    }).done();

                    self.mainMenu.then(function (menu) {
                        self._menu = menu;
                    });
                }
            });
        }
    },

    mainMenu: {
        value: null
    },

    user: {
        value: null
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
    }

});
