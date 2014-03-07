/**
 * @module ui/contextual-menu.reel
 * @requires montage/ui/component
 */
var Component = require("montage/ui/component").Component;

/**
 * @class ContextualMenu
 * @extends Component
 */
exports.ContextualMenu = Component.specialize(/** @lends ContextualMenu# */ {
    constructor: {
        value: function ContextualMenu() {
            this.super();
        }
    },

    position: {
        value: null
    },

    projectController: {
        value: null
    },

    selectedFileCell: {
        value: null
    },

    show: {
        value: function (position) {
            this.position = position;
            this.templateObjects.contextualMenuOverlay.show();
        }
    },

    hide: {
        value: function () {
            this.templateObjects.contextualMenuOverlay.hide();
        }
    },

    enterDocument: {
        value: function (firstTime) {
            if (!firstTime) {return;}

            // TODO because of the way the overly works, we can not listen on element, context-menu should extend o
            this.menu.addEventListener("contextmenu", this, false);
        }
    },

    surrendersActiveTarget: {
        value: function () {
            return true;
        }
    },

    willPositionOverlay: {
        value: function (overlay, calculatedPosition) {
            return this.position;
        }
    },

    shouldDismissOverlay: {
        value: function (overlay, target, evt) {
            this.dispatchEventNamed("hideContextualMenu", true, false);
            return true;
        }
    },

    handleContextmenu: {
        value: function (evt) {
            evt.stop();
        }
    }

});
