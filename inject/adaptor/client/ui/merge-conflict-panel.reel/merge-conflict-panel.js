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

    templateDidLoad: {
        value: function() {
            // getResponse() might be called before the template is loaded and therefore the detail strings defined in
            // the html are available, let's rebuild the detail
            this.updateDetail();
        }
    },

    resolution: {
        value: null
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
            this.aheadCount = ahead;
            this.behindCount = behind;
            this.resolutions = resolutions;
            this.resolution = null;     // reset the resolution to force the user to make a selection

            this.updateDetail();

            this._needsFocus = true;
            this.needsDraw = true;

            this._deferredResponse = Promise.defer();
            return this._deferredResponse.promise;
        }
    },

    updateDetail: {
        value: function() {
            var self = this,
                detailID,
                detail;

            if (this.aheadCount || this.behindCount) {
                detailID = (this.aheadCount > 1 ? 2 : 0) + (this.behindCount > 1 ? 1 : 0);
                detail = this["detail_" + detailID];
                if (detail !== undefined) {
                    this.detail = detail.replace(/\{\$([^}]*)\}/g, function(match, param) {
                        return self[param] || "";
                    });
                }
            }
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
