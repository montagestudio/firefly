/*jshint browser:true */
/*global URL:true */
var Montage = require("montage").Montage,
    Promise = require("montage/core/promise").Promise,
    Connection = require("q-connection"),
    adaptConnection = require("q-connection/adapt"),
    FileDescriptor = require("./file-descriptor").FileDescriptor,
    mainMenu = require("adaptor/client/core/menu").defaultMenu,
    RepositoryController = require("adaptor/client/core/repository-controller").RepositoryController,
    URL = require("core/url");

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

    progressPanel: {
        value: null
    },

    promptPanel: {
        value: null
    },

    applicationDelegate: {
        value: null
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

    _previewUrl: {
        value: null
    },

    _packageUrl: {
        value: null
    },

    packageUrl: {
        get: function () {
            if(!this._packageUrl) {
                var self = this;
                this._packageUrl = this.backend.get("env-service").get("projectUrl")
                .then(function (url) {
                    // The PreviewController depends on this changing
                    self.dispatchOwnPropertyChange("previewUrl", self.previewUrl);

                    return self.repositoryController._request({
                        method: "POST",
                        url: url + "/session",
                        withCredentials: true,
                        data: document.cookie.match(/session=([^;]+)/)[1]
                    }).thenResolve(url);
                });
            }
            return this._packageUrl;
        }
    },


    projectUrl: {
        get: function () {
            return this.packageUrl;
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
                        "fileUrl": packageUrl,
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
            // Don't indirectly kick off a connection to the backend, because
            // this must be delayed until the local clone exists
            if (this._packageUrl) {
                var url = this._packageUrl.inspect().value;
                return url ? url + "/index.html" : void 0;
            }
        }
    },

    logoutUrl: {
        get: function () {
            return "/logout";
        }
    },

    listTreeAtUrl: {
        value: function (url, exclude) {
            return this.backend.get("file-service").invoke("listTree", url, exclude).then(function (fileDescriptors) {
                return fileDescriptors.map(function (fd) {
                    return FileDescriptor.create().initWithUrlAndStat(fd.url, fd.stat);
                });
            });
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

    listAssetAtUrl: {
        value: function (url, exclude) {
            return this.backend.get("file-service").invoke("listAsset", url, exclude).then(function (fileDescriptors) {
                return fileDescriptors.map(function (fd) {
                    var fileDescriptor = FileDescriptor.create().initWithUrlAndStat(fd.url, fd.stat);
                    fileDescriptor.mimeType = fd.mimeType;
                    return fileDescriptor;
                });
            });
        }
    },

    detectMimeTypeAtUrl: {
        value: function (url) {
            return this.backend.get("file-service").invoke("detectMimeTypeAtUrl", url);
        }
    },

    watch: {
        value: function (url, ignoreSubPaths, changeHandler, errorHandler) {
            var handlers = {
                handleChange: Promise.master(changeHandler),
                handleError: Promise.master(errorHandler)
            };

            return this.backend.get("file-service").invoke("watch", url, ignoreSubPaths, handlers);
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
        value: function (name, url) {
            this._previewUrl = url;
            return this.backend.get("preview-service").invoke("register", {name: name, url: url});
        }
    },

    unregisterPreview: {
        value: function () {
            var self = this;

            return this.backend.get("preview-service").invoke("unregister", this._previewUrl)
            .then(function() {
                self._previewUrl = null;
            });
        }
    },

    launchPreview: {
        value: function () {
            return Promise.resolve();
        }
    },

    refreshPreview: {
        value: function () {
            return this.backend.get("preview-service").invoke("refresh", this._previewUrl);
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

    listLibraryItemUrls: {
        value: function (extensionUrl, packageName) {
            return this.backend.get("extension-service").invoke("listLibraryItemUrls", extensionUrl, packageName);
        }
    },

    listModuleIconUrls: {
        value: function (extensionUrl, packageName) {
            return this.backend.get("extension-service").invoke("listModuleIconUrls", extensionUrl, packageName);
        }
    },

    promptForSave: {
        value: function (options) {
            var appDelegate = this.applicationDelegate;
            appDelegate.currentPanelKey = "prompt";
            appDelegate.showModal = true;

            return this.promptPanel.getResponse(options.prompt, options.defaultName, options.submitLabel).then(function (response) {
                //TODO sanitize input
                if (response) {
                    response = options.defaultDirectory + "/" + response;
                }
                appDelegate.showModal = false;
                appDelegate.currentPanelKey = null;
                return response;
            });
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
            return this.repositoryController.createComponent(name).then(function(response) {
                if (response.error) {
                    throw new Error(response.error);
                }

                return URL.parse(name).pathname;
            });
        }
    },

    createModule: {
        value: function (name) {
            return this.repositoryController.createModule(name).then(function(response) {
                if (response.error) {
                    throw new Error(response.error);
                }

                return URL.parse(name).pathname;
            });
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
            var promise = this.repositoryController.initializeRepositoryWorkspace();

            this.progressPanel.message = "Fetching Project";
            this.progressPanel.activityPromise = promise;

            return promise;
        }
    },

    isProjectEmpty: {
        value: function() {
            return this.repositoryController.isRepositoryEmpty();
        }
    },

    isMontageRepository: {
        value: function() {
            return this.repositoryController.isMontageRepository();
        }
    },

    repositoryExists: {
        value: function() {
            return this.repositoryController.repositoryExists();
        }
    },

    projectExists: {
        value: function() {
            return this.repositoryController.workspaceExists();
        }
    },

    /**
     * Pushes all commits to remote repository.
     */
    flushProject: {
        value: function(message) {
            return this.repositoryController.flush(message);
        }
    },

    /**
     * Saves a file and creates a new commit for the change.
     */
    saveFile: {
        value: function(contents, location) {
            return this.repositoryController.saveFile(URL.parse(location).pathname, contents).then(function (response) {
                if (response.error) {
                    throw new Error(response.error);
                }
                return response;
            });
        }
    },

    save: {
        value: function (editingDocument, location) {
            var self = this;
            var name = URL.parse(editingDocument.url).pathname;

            return editingDocument.save(location, this.saveFile.bind(this))
            .then(function() {
                return self.flushProject("Update component " + name);
            });
        }
    },

    listDependenciesAtUrl: {
        value: function (packageUrl) {
            return this.backend.get("package-manager-service").invoke("listDependenciesAtUrl", packageUrl);
        }
    },

    removePackage: {
        value: function (packageName) {
            return this.backend.get("package-manager-service").invoke("removePackage", packageName);
        }
    },

    findOutdatedDependency: {
        value: function () {
            return this.backend.get("package-manager-service").invoke("findOutdatedDependency");
        }
    },

    installPackages: {
        value: function (requestedPackages) {
            return this.backend.get("package-manager-service").invoke("installPackages", requestedPackages);
        }
    },

    gatherPackageInformation: {
        value: function (requestedPackage) {
            return this.backend.get("package-manager-service").invoke("gatherPackageInformation", requestedPackage);
        }
    },

    searchPackages: {
        value: function (packages) {
            return this.backend.get("package-manager-service").invoke("searchPackages", packages);
        }
    },

    installProjectPackages: {
        value: function (packages) {
            return this.backend.get("package-manager-service").invoke("installProjectPackages");
        }
    },

    /**
     * Repository functions.
     */
    listRepositoryBranches: {
        value: function (packages) {
            return this.backend.get("repository-service").invoke("listBranches");
        }
    }
});
