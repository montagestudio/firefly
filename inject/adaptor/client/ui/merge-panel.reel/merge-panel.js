/**
 * @module ui/merge-panel.reel
 * @requires montage/ui/component
 */
var Component = require("montage/ui/component").Component,
    Promise = require("montage/core/promise").Promise;

/**
 * @class MergePanel
 * @extends Component
 */
exports.MergePanel = Component.specialize(/** @lends MergePanel# */ {
    constructor: {
        value: function MergePanel() {
            this.super();
        }
    },

    branchName: {
        value: "master"
    },

    commitCount: {
        value: 0
    },

    squashCommits: {
        value: false
    },

    squashMessage: {
        value: "Merge"
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
                    squash: this.squashCommits,
                    message: this.squashMessage
                });
            }
        }
    },

    getResponse: {
        value: function (branch, commitCount, squash, message) {
            var index;

            if (this._deferredResponse) {
                //TODO maybe simply add it to the queue of things to prompt for, in order?
                this._deferredResponse.reject(new Error("Initialization instructed to get a different response"));
            }

            index = branch.indexOf("/");
            if (index !== -1) {
                branch = branch.substring(index + 1);
            }

            this.squashCommits = squash || true;
            this.squashMessage = message || this.squashMessage;
            this.branchName = branch || this.branchName;
            this.commitCount = parseInt(commitCount, 10);

            this._needsFocus = true;
            this.needsDraw = true;

            this._deferredResponse = Promise.defer();
            return this._deferredResponse.promise;
        }
    },

    draw: {
        value: function () {
            if (this._needsFocus) {
                var commitMessageField = this.templateObjects.commitMessageField;

                this.eventManager.activeTarget = commitMessageField;
                commitMessageField.element.focus();
                commitMessageField.element.select();
                this._needsFocus = false;
            }
        }
    }
});
