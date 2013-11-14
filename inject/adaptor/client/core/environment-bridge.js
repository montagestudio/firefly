/*jshint browser:true */
var Montage = require("montage").Montage,
    Promise = require("montage/core/promise").Promise;
    FileDescriptor = require("./file-descriptor").FileDescriptor;

var PROJECT_PROTOCOL = "fs:";

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

    _userName: {
        value: null
    },

    _projectName: {
        value: null
    },

    projectUrl: {
        get: function () {
            var pathComponents = window.location.pathname.replace(/^\//, "").split("/"),
                user,
                project,
                url = null;

            if (pathComponents.length >= 2) {
                this._userName = user = pathComponents[0];
                this._projectName = project = pathComponents[1];
                url = PROJECT_PROTOCOL + "//github/" + user + "/" + project;
            }

            return url;
        }
    },

    projectInfo: {
        value: function () {

            //TODO use a final url when it's ready
            // var packageUrl = window.location.origin + "/" + this._userName + "/" + this._projectName + "/tree";
            var packageUrl = window.location.origin + "/clone";
            var dependencies = [];

            return Promise.resolve({
                "fileUrl": this.projectUrl,
                "packageUrl": packageUrl,
                "dependencies": dependencies
            });
        }
    },

    previewUrl: {
        get: function () {
            //TODO replace with a url when available
            return window.location.origin + "/clone/index.html";
        }
    },

    list: {
        value: function (url) {

            //TODO actually implement this

            var fakefd = FileDescriptor.create().initWithUrlAndStat("fs://localhost/foo.reel/", 0);

            return Promise.resolve([fakefd]);
        }
    },

    watch: {
        value: function () {
            console.log("watch", arguments)
            return Promise.resolve(true);
        }
    },

    getExtensionsAt: {
        value: function () {
            return [];
        }
    },

    componentsInPackage: {
        value: function () {
            return Promise.resolve(null);
        }
    },

    registerPreview: {
        value: function () {
            return Promise.resolve("");
        }
    },

    launchPreview: {
        value: function () {
            return Promise.resolve(true);
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
