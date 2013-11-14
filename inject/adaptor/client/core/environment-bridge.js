/*jshint browser:true */
var Montage = require("montage").Montage,
    Promise = require("montage/core/promise").Promise,
    Connection = require("q-connection"),
    adaptConnection = require("q-connection/adapt"),
    FileDescriptor = require("./file-descriptor").FileDescriptor;

var PROJECT_PROTOCOL = "fs:";

// TODO we should only inject the base prototype of generic services this environment provides
// the hosted application may build on top of that with specific features it needs of the bridge
// i.e. we shouldn't expect the environment bridge the host provides to know about the needs of all potential guests

exports.EnvironmentBridge = Montage.specialize({

    constructor: {
        value: function EnvironmentBridge() {
            this.super();
        }
    },

    init: {
        value: function () {
            return this;
        }
    },

    _backend: {
        value: null
    },

    backend: {
        get: function () {
            var self = this;

            if (!self._backend) {
                var connection = adaptConnection(new WebSocket("ws://" + window.location.host));

                connection.closed.then(function () {
                    self._backend = null;
                }).done();

                self._backend = Connection(connection);
                self._backend.done();
            }

            return self._backend;
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
                url = PROJECT_PROTOCOL + "//" + user + "/" + project;
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
            return this.backend.get("file-services").invoke("list", url).then(function (fileDescriptors) {
                debugger
                return fileDescriptors.map(function (fd) {
                    return FileDescriptor.create().initWithUrlAndStat(fd.url, fd.stat);
                });
            });
        }
    },

    watch: {
        value: function () {
            console.log("watch", arguments);
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
    },

    openFileWithDefaultApplication: {
        value: function (file) {
            return Promise.resolve(null);
        }
    }

});
