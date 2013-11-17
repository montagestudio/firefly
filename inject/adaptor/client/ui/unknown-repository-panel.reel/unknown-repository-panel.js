/**
 * @module ui/unknown-repository-panel.reel
 * @requires montage/ui/component
 */
var Component = require("montage/ui/component").Component;

/**
 * @class UnknownRepositoryPanel
 * @extends Component
 */
exports.UnknownRepositoryPanel = Component.specialize(/** @lends UnknownRepositoryPanel# */ {
    constructor: {
        value: function UnknownRepositoryPanel() {
            this.super();
        }
    },

    handleCreateButtonAction: {
        value: function (evt) {
            evt.stopPropagation();
            this.dispatchEventNamed("createRepository", true, true);
            //TODO also trigger initialization when appropriate
        }
    }
});
