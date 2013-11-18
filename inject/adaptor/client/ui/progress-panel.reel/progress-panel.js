/**
 * @module ui/progress-panel.reel
 * @requires montage/ui/component
 */
var Component = require("montage/ui/component").Component;

/**
 * @class ProgressPanel
 * @extends Component
 */
exports.ProgressPanel = Component.specialize(/** @lends ProgressPanel# */ {
    constructor: {
        value: function ProgressPanel() {
            this.super();
        }
    },

    message: {
        value: null
    },

    _activityPromise: {
        value: null
    },

    activityPromise: {
        get: function () {
            return this._activityPromise;
        },
        set: function (value) {
            if (value === this._activityPromise) {
                return;
            }

            this._activityPromise = value;
            this.progress = 0;

            if (this._activityPromise) {
                this._activityPromise.then(
                    this._acceptSuccess.bind(this),
                    this._acceptFailure.bind(this),
                    this._acceptProgress.bind(this)
                )
            }
        }
    },

    _acceptSuccess: {
        value: function (success) {
            //TODO only accept the completion if the process is from the same promise
            this.progress = this.progressMax;
        }
    },

    _acceptFailure: {
        value: function (failure) {

        }
    },

    _acceptProgress: {
        value: function (progress) {

        }
    },

    progressMax: {
        value: 100
    },

    progress: {
        value: 0
    },

    progressIsIndeterminite: {
        value: false
    }
});
