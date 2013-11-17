/*jshint browser:true */
var Montage = require("montage").Montage,
    Promise = require("montage/core/promise").Promise,
    Connection = require("q-connection"),
    adaptConnection = require("q-connection/adapt"),
    FileDescriptor = require("./file-descriptor").FileDescriptor,
    mainMenu = require("adaptor/client/core/menu").defaultMenu,
    RepositoryController = require("adaptor/client/core/repository-controller").RepositoryController;

var PROJECT_PROTOCOL = "fs:";

// TODO we should only inject the base prototype of generic services this environment provides
// the hosted application may build on top of that with specific features it needs of the bridge
// i.e. we shouldn't expect the environment bridge the host provides to know about the needs of all potential guests

exports.EnvironmentBridge = Montage.specialize({

    constructor: {
        value: function EnvironmentBridge() {
            this.super();
            var pathComponents = window.location.pathname.replace(/^\//, "").split("/");
            if (pathComponents.length >= 2) {
                this._userName = pathComponents[0];
                this._projectName = pathComponents[1];
            }
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
                var connection = adaptConnection(new WebSocket("ws://" + window.location.host + window.location.pathname));

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

    _packageUrl: {
        value: null
    },

    packageUrl: {
        get: function () {
            if(!this._packageUrl) {
                this._packageUrl = this.backend.get("env-service").get("projectUrl")
                .then(function (url) {
                    var xhr = new XMLHttpRequest();
                    xhr.withCredentials = true;
                    xhr.open("post", url + "/session");
                    xhr.send(document.cookie.match(/session=([^;]+)/)[1]);

                    return url;
                });
            }
            return this._packageUrl;
        }
    },


    projectUrl: {
        get: function () {
            var user = this._userName,
                project = this._projectName,
                url = null;

            if (user && project) {
                url = PROJECT_PROTOCOL + "//" + user + "/" + project;
            }

            return url;
        }
    },

    projectInfo: {
        value: function () {
            var self = this;
            //TODO use a final url when it's ready
            // var packageUrl = window.location.origin + "/" + this._userName + "/" + this._projectName + "/tree";
            // var packageUrl = "http://localhost:2441";

            return self.packageUrl.then(function (packageUrl) {
                return self.dependenciesInPackage(packageUrl).then(function (dependencies) {
                    return {
                        "fileUrl": this.projectUrl,
                        "packageUrl": packageUrl,
                        "dependencies": dependencies
                    };
                });
            });
        }
    },

    dependenciesInPackage: {
        value: function (packageUrl) {

            return this.backend.get("file-service").invoke("read", packageUrl + "/package.json")
                .then(function (content) {
                    var packageInfo = JSON.parse(content),
                        dependencyNames,
                        dependencies;

                    if (packageInfo.dependencies) {
                        dependencyNames = Object.keys(packageInfo.dependencies);

                        //TODO implement mapping in addition to just dependencies
                        //TODO also report the version of the dependency
                        dependencies = dependencyNames.map(function (dependencyName) {
                            return {"dependency": dependencyName, "url": packageUrl + "/node_modules/" + dependencyName};
                        });
                    } else {
                        dependencies = [];
                    }

                    return dependencies;
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
            return this.backend.get("file-service").invoke("list", url).then(function (fileDescriptors) {
                return fileDescriptors.map(function (fd) {
                    return FileDescriptor.create().initWithUrlAndStat(fd.url, fd.stat);
                });
            });
        }
    },

    watch: {
        value: function () {
            // console.log("watch", arguments);
            return Promise.resolve(true);
        }
    },

    getExtensionsAt: {
        value: function () {
            return [];
        }
    },

    componentsInPackage: {
        value: function (url) {
            return this.backend.get("file-service").invoke("listPackage", url, true).then(function (fileDescriptors) {
                return fileDescriptors.filter(function (fd) {
                    return (/\.reel\/$/).test(fd.url);
                }).map(function (fd) {
                    return fd.url;
                });
            });
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
            return this.backend.get("extension-service").invoke("getExtensions");
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
        value: function (name) {
            return this.repositoryController.createComponent(name);
        }
    },

    openFileWithDefaultApplication: {
        value: function (file) {
            return Promise.resolve(null);
        }
    },

    mainMenu: {
        get: function () {
            return Promise.resolve(mainMenu);
        }
    },

    _repositoryController: {
        value: null
    },

    repositoryController: {
        get: function() {
            if (!this._repositoryController) {
                this._repositoryController = new RepositoryController()
                    .init(this._userName, this._projectName);
            }

            return this._repositoryController;
        }
    },

    initializeProject: {
        value: function() {
            return this.repositoryController.initializeRepositoryWorkspace();
        }
    },

    isProjectEmpty: {
        value: function() {
            return this.repositoryController.isRepositoryEmpty();
        }
    }

});
