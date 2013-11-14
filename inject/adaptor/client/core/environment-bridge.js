/*jshint browser:true */
var Montage = require("montage").Montage,
    Promise = require("montage/core/promise").Promise;

exports.EnvironmentBridge = Montage.specialize({

    constructor: {
        value: function EnvironmentBridge() {
            this.super();
        }
    },

    init: {
        value: function (backendName) {
            this._backendName = backendName;

            return this;
        }
    },

    projectInfo: {
        get: function () {
            return Promise.resolve({"fileUrl": require.getPackage({name: "palette"}).location + "templates/component.reel"});
        }
    },

    setDocumentDirtyState: {
        value: function () {
        }
    },

    availableExtensions: {
        get: function () {
            return Promise.resolve(null);
        }
    },

    promptForSave: {
        value: function () {
            return Promise.resolve(null);
        }
    },

    openHttpUrl: {
        value: function (url) {
            var deferredWindow = Promise.defer(),
                newWindow = window.open(url);

            if (newWindow) {
                deferredWindow.resolve(newWindow);
            } else {
                deferredWindow.reject( new Error("Failed to open window to " + url));
            }

            return deferredWindow.promise;
        }
    },

    createComponent: {
        value: function () {

        }
    }

});
