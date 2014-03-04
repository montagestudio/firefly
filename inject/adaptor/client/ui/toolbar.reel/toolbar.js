/*global window */
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
            var self = this;
            this.super();

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
                        self.menu = menu;
                    });
                }
            });
        }
    },

    menu: {
        value: null
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
