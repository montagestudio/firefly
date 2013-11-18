/**
 * @module ui/prompt-panel.reel
 * @requires montage/ui/component
 */
var Component = require("montage/ui/component").Component,
    Promise = require("montage/core/promise").Promise;

var DEFAULT_SUBMIT_LABEL = "Submit",
    DEFAULT_CANCEL_LABEL = "Cancel";

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

    message: {
        value: null
    },

    value: {
        value: null
    },

    submitLabel: {
        value: DEFAULT_SUBMIT_LABEL
    },

    cancelLabel: {
        value: DEFAULT_CANCEL_LABEL
    },

    handleCancelButtonAction: {
        value: function (evt) {
            if (this._deferredResponse) {
                this._deferredResponse.resolve();
                this._reset();
            }
        }
    },

    handleSubmitButtonAction: {
        value: function (evt) {
            if (this._deferredResponse) {
                this._deferredResponse.resolve(this.value);
                this._reset();
            }
        }
    },

    _reset: {
        value: function () {
            this.message = null;
            this.value = null;
            this.submitLabel = DEFAULT_SUBMIT_LABEL;
            this.cancelLabel = DEFAULT_CANCEL_LABEL;
            this._deferredResponse = null;
        }
    },

    _deferredResponse: {
        value: null
    },

    _needsFocus: {
        value: false
    },

    getResponse: {
        value: function (message, defaultValue, submitLabel, cancelLabel) {
            if (this._deferredResponse) {
                //TODO maybe simply add it to the queue of things to prompt for, in order?
                this._deferredResponse.reject(new Error("Prompt instructed to get a different response"));
            }

            this.message = message;
            this.value = defaultValue;
            this.submitLabel = submitLabel || DEFAULT_SUBMIT_LABEL;
            this.cancelLabel = cancelLabel || DEFAULT_CANCEL_LABEL;
            this._needsFocus = true;
            this.needsDraw = true;

            this._deferredResponse = Promise.defer();
            return this._deferredResponse.promise;
        }
    },

    draw: {
        value: function () {
            if (this._needsFocus) {
                this.templateObjects.inputField.element.select();
                this._needsFocus = false;
            }
        }
    }
});
