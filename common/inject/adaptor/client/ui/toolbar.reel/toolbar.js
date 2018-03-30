/*global window */
/**
 * @module ui/toolbar.reel
 * @requires montage/ui/component
 */
var Component = require("montage/ui/component").Component,
    application = require("montage/core/application").application;

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
                    self.userMenu = bridge.userMenu;
                    // TODO this is more of a hack than anything else, should be rethink
                    self.userMenu.activePath = [];

                    bridge.userController.getUser()
                        .then(function (user) {
                            self.user = user;
                        }).done();

                    bridge.repositoryController.getRepositoryUrl()
                    .then(function(url) {
                        self.sourceUrl = url;
                    }).done();
                }
            });

            this.addPathChangeListener("mainMenu", function (mainMenu) {
                if (mainMenu) {
                    self.menu = mainMenu;
                }
            });
        }
    },

    enterDocument: {
        value: function (firstTime) {
            if (!firstTime) { return; }
            application.addEventListener("menuAction", this, false);
        }
    },

    menu: {
        value: null
    },

    userMenu: {
        value: null
    },

    mainMenu: {
        value: null
    },

    user: {
        value: null
    },

    handleHomeButtonAction: {
        value: function () {
            this.application.delegate.changeLocation("/");
        }
    },

    handleMenuAction: {
        value: function (evt) {
            switch (evt.detail.identifier) {
            case "source":
                window.open(this.sourceUrl);
                break;
            case "logout":
                window.location.href = this.environmentBridge.logoutUrl;
                break;
            }
        }
    },

    sourceUrl: {
        value: null
    }

});
