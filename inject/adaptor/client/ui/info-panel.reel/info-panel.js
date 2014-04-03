/**
 * @module ui/info-panel.reel
 */
var Component = require("montage/ui/component").Component,
    Promise = require("montage/core/promise").Promise;

var DEFAULT_OK_LABEL = "Ok";

/**
 * @class InfoPanel
 * @extends Component
 */
exports.InfoPanel = Component.specialize(/** @lends InfoPanel# */ {
    constructor: {
        value: function InfoPanel() {
            this.super();
        }
    },

    message: {
        value: null
    },

    okLabel: {
        value: DEFAULT_OK_LABEL
    },

    handleOkButtonAction: {
        value: function (evt) {
            this._submit();
        }
    },

    _discard: {
        value: function () {
            if (this._deferredResponse) {
                this._deferredResponse.resolve();
                this._reset();
            }
        }
    },

    _submit: {
        value: function () {
            if (this._deferredResponse) {
                this._deferredResponse.resolve(this.value);
                this._reset();
            }
        }
    },

    _reset: {
        value: function () {
            this.message = null;
            this.okLabel = DEFAULT_OK_LABEL;
        }
    },

    _needsFocus: {
        value: false
    },

    getResponse: {
        value: function (message, okLabel) {
            if (this._deferredResponse) {
                //TODO maybe simply add it to the queue of things to prompt for, in order?
                this._deferredResponse.reject(new Error("Prompt instructed to get a different response"));
            }

            this.message = message;
            this.okLabel = okLabel || DEFAULT_OK_LABEL;
            this._needsFocus = true;
            this.needsDraw = true;

            this._deferredResponse = Promise.defer();
            return this._deferredResponse.promise;
        }
    },

    draw: {
        value: function () {
            if (this._needsFocus) {
                this.eventManager.activeTarget = this.templateObjects.okButton;
                this._needsFocus = false;
            }
        }
    }
});
