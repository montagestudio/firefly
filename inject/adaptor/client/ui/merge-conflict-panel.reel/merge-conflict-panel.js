/**
 * @module ui/merge-conflict-panel.reel
 * @requires montage/ui/component
 */
var Component = require("montage/ui/component").Component,
    Promise = require("montage/core/promise").Promise;

/**
 * @class MergeConflictPanel
 * @extends Component
 */
exports.MergeConflictPanel = Component.specialize(/** @lends MergeConflictPanel# */ {
    constructor: {
        value: function MergeConflictPanel() {
            this.super();
        }
    },

    resolution: {
        value: null
    },

    resolutions: {
        value: null
    },

    localBranchName: {
        value: ""
    },

    remoteBranchName: {
        value: ""
    },

    aheadCount: {
        value: 0
    },

    behindCount: {
        value: 0
    },

    _deferredResponse: {
        value: null
    },

    _needsFocus: {
        value: false
    },

    handleCancelButtonAction: {
        value: function (evt) {
            if (this._deferredResponse) {
                this._deferredResponse.resolve(false);
            }
        }
    },

    handleSubmitButtonAction: {
        value: function (evt) {
            if (this._deferredResponse) {
                this._deferredResponse.resolve({
                    resolution: this.resolution
                });
            }
        }
    },

    getResponse: {
        value: function (message, local, remote, ahead, behind, resolutions) {
            var index;

            if (this._deferredResponse) {
                //TODO maybe simply add it to the queue of things to prompt for, in order?
                this._deferredResponse.reject(new Error("Initialization instructed to get a different response"));
            }

            index = remote.indexOf("/");
            if (index !== -1) {
                remote = remote.substring(index + 1);
            }

            this.message = message;
            this.localBranchName = local;
            this.remoteBranchName = remote;
            this.aheadCount = parseInt(ahead, 10);
            this.behindCount = parseInt(behind, 10);
            this.resolutions = resolutions;
            this.resolution = null;     // reset the resolution to force the user to make a selection

            this._needsFocus = true;
            this.needsDraw = true;

            this._deferredResponse = Promise.defer();
            return this._deferredResponse.promise;
        }
    },

    draw: {
        value: function () {
            if (this._needsFocus) {
                this.eventManager.activeTarget = this.templateObjects.initializeButton;
                this._needsFocus = false;
            }
        }
    }
});
