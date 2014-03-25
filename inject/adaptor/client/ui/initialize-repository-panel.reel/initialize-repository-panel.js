/*global window */
/**
 * @module ui/initialize-repository-panel.reel
 * @requires montage/ui/component
 */
var Component = require("montage/ui/component").Component,
    Promise = require("montage/core/promise").Promise;

/**
 * @class InitializeRepositoryPanel
 * @extends Component
 */
// TODO bring this more in line with the confirm dialog
exports.InitializeRepositoryPanel = Component.specialize(/** @lends InitializeRepositoryPanel# */ {
    constructor: {
        value: function InitializeRepositoryPanel() {
            this.super();
        }
    },

    handleCancelButtonAction: {
        value: function (evt) {
            if (this._deferredResponse) {
                this._deferredResponse.resolve(false);
            }
        }
    },

    _deferredResponse: {
        value: null
    },

    handleInitializeButtonAction: {
        value: function (evt) {
            if (this._deferredResponse) {
                this._deferredResponse.resolve(true);
            }
        }
    },

    _needsFocus: {
        value: false
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
