/*global window */
/**
 * @module ui/initialize-repository-panel.reel
 * @requires montage/ui/component
 */
var Component = require("montage/ui/component").Component;

/**
 * @class InitializeRepositoryPanel
 * @extends Component
 */
exports.InitializeRepositoryPanel = Component.specialize(/** @lends InitializeRepositoryPanel# */ {
    constructor: {
        value: function InitializeRepositoryPanel() {
            this.super();
        }
    },

    handleCancelButtonAction: {
        value: function (evt) {
            window.location = "/";
        }
    },

    handleInitializeButtonAction: {
        value: function (evt) {
            evt.stopPropagation();
            this.dispatchEventNamed("initializeRepository", true, true);
        }
    }
});
