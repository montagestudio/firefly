/**
 * @module ui/prompt-panel.reel
 * @requires montage/ui/component
 */
var Component = require("montage/ui/component").Component;

/**
 * @class PromptPanel
 * @extends Component
 */
exports.PromptPanel = Component.specialize(/** @lends PromptPanel# */ {
    constructor: {
        value: function PromptPanel() {
            this.super();
        }
    },

    submitLabel: {
        value: "Submit"
    },

    cancelLabel: {
        value: "Cancel"
    },

    handleCancelButtonAction: {
        value: function (evt) {

        }
    },

    handleSubmitButtonAction: {
        value: function (evt) {

        }
    }
});
