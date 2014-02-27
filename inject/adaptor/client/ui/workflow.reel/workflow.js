/**
 * @module ui/workflow.reel
 * @requires montage/ui/component
 */
var Component = require("montage/ui/component").Component;

/**
 * @class Workflow
 * @extends Component
 */

exports.Workflow = Component.specialize(/** @lends Menu# */ {
    constructor: {
        value: function Workflow() {
            this.super();

            this.addBeforePathChangeListener("projectDocument.isProjectDirty", this, "capturePanelKeyChange");
            this.addPathChangeListener("projectDocument.isProjectDirty", this, "handlePanelKeyChange");

            this.addBeforePathChangeListener("projectDocument.isBusy", this, "capturePanelKeyChange");
            this.addPathChangeListener("projectDocument.isBusy", this, "handlePanelKeyChange");

            this.addBeforePathChangeListener("projectDocument.aheadCount", this, "capturePanelKeyChange");
            this.addPathChangeListener("projectDocument.aheadCount", this, "handlePanelKeyChange");
        }
    },

    projectDocument: {
        value: null
    },

    capturePanelKeyChange: {
        value: function () {
            this.dispatchBeforeOwnPropertyChange("panelKey", this.panelKey);
        }
    },

    handlePanelKeyChange: {
        value: function () {
            this.dispatchOwnPropertyChange("panelKey", this.panelKey);
        }
    },

    panelKey: {
        get: function () {
            var doc = this.projectDocument,
                key = "pristine";

            if (doc) {
                if (doc.isBusy) {
                    key = "busy";
                } else {
                    if (doc.isProjectDirty) {
                        key = "dirty";
                    } else if (doc.aheadCount !== 0 && doc.behindCount !== 0) {
                        key= "diverged";
                    } else if (doc.aheadCount !== 0) {
                        key = "ahead";
                    } else if (doc.behindCount !== 0) {
                        key = "behind";
                    }
                }
            }

            return key;
        }
    },

    //TODO react to busy/unknown state of projectDocument

    handleAcceptButtonAction: {
        value: function (evt) {
            this.projectDocument.accept().done();
        }
    },

    handleDiscardButtonAction: {
        value: function (evt) {
            this.projectDocument.discard().done();
        }
    },

    handleMergeButtonAction: {
        value: function (evt) {
            this.projectDocument.merge().done();
        }
    },

    handleResetButtonAction: {
        value: function (evt) {
            this.projectDocument.reset().done();
        }
    }
});
