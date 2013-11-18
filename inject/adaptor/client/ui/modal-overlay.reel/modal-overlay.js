/**
 * @module ui/modal-overlay.reel
 * @requires montage/ui/component
 */
var Component = require("montage/ui/component").Component;

/**
 * @class ModalOverlay
 * @extends Component
 */
exports.ModalOverlay = Component.specialize(/** @lends ModalOverlay# */ {
    constructor: {
        value: function ModalOverlay() {
            this.super();
        }
    },

    visible: {
        value: true
    }
});
