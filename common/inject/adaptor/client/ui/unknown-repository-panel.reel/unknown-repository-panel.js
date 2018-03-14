/**
 * @module ui/unknown-repository-panel.reel
 * @requires montage/ui/component
 */
var Component = require("montage/ui/component").Component,
    Promise = require("montage/core/promise").Promise;

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

    owner: {
        value: null
    },

    repo: {
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

    handleCreateButtonAction: {
        value: function (evt) {
            if (this._deferredResponse) {
                this._deferredResponse.resolve({
                    name: this.repo
                });
            }
        }
    },

    getResponse: {
        value: function () {
            if (this._deferredResponse) {
                //TODO maybe simply add it to the queue of things to prompt for, in order?
                this._deferredResponse.reject(new Error("Initialization instructed to get a different response"));
            }

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
