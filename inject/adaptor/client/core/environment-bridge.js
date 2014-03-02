/*jshint browser:true */
/*global URL:true */
var Montage = require("montage").Montage,
    Promise = require("montage/core/promise").Promise,
    Connection = require("q-connection"),
    adaptConnection = require("q-connection/adapt"),
    FileDescriptor = require("./file-descriptor").FileDescriptor,
    mainMenu = require("adaptor/client/core/menu").defaultMenu,
    RepositoryController = require("adaptor/client/core/repository-controller").RepositoryController,
    UserController = require("adaptor/client/core/user-controller").UserController,
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
        value: function (name, frontendService) {
            this._frontendService = frontendService;
            return this;
        }
    },

    _frontendService: {
        value: null
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
                var protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
                var connection = adaptConnection(new WebSocket(protocol + "//" + window.location.host + window.location.pathname));

                connection.closed.then(function () {
                    self._backend = null;
                }).done();

                self._backend = Connection(connection, this._frontendService);
                self._backend.done();

                // every 20 seconds
                this._startPing(20000);
            }

            return self._backend;
        }
    },

    _pingStarted: {
        value: false
    },
    _startPing: {
        value: function (delay) {
            var self = this;
            var ping = function () {
                if ((document.webkitVisibilityState || document.visibilityState) === "visible") {
                    // Note 1: using .backend and not ._backend will cause a
                    // reconnection when the page becomes visible again
                    // (through the "visibilitychange" event)
                    // Note 2: Using .get because it's more efficient than .invoke
                    self.backend.get("ping")
                    .then(function () {
                        setTimeout(ping, delay);
                    })
                    .done();
                }
            };

            // If pinging has already been setup, then don't kick it off again
            if (!this._pingStarted) {
                this._pingStarted = true;
                var visibilitychange = document.webkitVisibilityState ? "webkitvisibilitychange" : "visibilitychange";
                document.addEventListener(visibilitychange, ping, false);
                ping();
            }
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

                    self._patchXhr(url);

                    return self.repositoryController._request({
                        method: "POST",
                        url: url + "/session",
                        withCredentials: true,
                        data: {
                            sessionId: document.cookie.match(/session=([^;]+)/)[1]
                        }
                    }).thenResolve(url);
                });
            }
            return this._packageUrl;
        }
    },

    // This hack ensures that all XHRs to the projectUrl, which is on a
    // separate domain, are made with credentials (cookies) so that the session
    // cookie that gives access to the files is sent.
    _patchXhr: {
        value: function (withCredentialsUrl) {
            var XHR = window.XMLHttpRequest;
            window.XMLHttpRequest = function () {
                var xhr = new XHR();
                var open = xhr.open;
                xhr.open = function (method, url) {
                    if (url.indexOf(withCredentialsUrl) !== -1) {
                        this.withCredentials = true;
                    }
                    return open.apply(this, arguments);
                };
                return xhr;
            };
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
            return this.backend.get("preview-service").invoke("register");
        }
    },

    unregisterPreview: {
        value: function () {
            var self = this;

            // If the websocket isn't connected don't trigger a reconnect
            if (this._backend) {
                return this.backend.get("preview-service").invoke("unregister")
                .then(function() {
                    self._previewUrl = null;
                });
            } else {
                return Promise();
            }
        }
    },

    launchPreview: {
        value: function () {
            return Promise.resolve();
        }
    },

    refreshPreview: {
        value: function () {
            return this.backend.get("preview-service").invoke("refresh");
        }
    },

    setPreviewObjectProperties: {
        value: function(previewId, label, ownerModuleId, properties) {
            return this.backend.get("preview-service").invoke("setObjectProperties", label, ownerModuleId, properties);
        }
    },

    setPreviewObjectProperty: {
        value: function(previewId, ownerModuleId, label, propertyName, propertyValue, propertyType) {
            return this.backend.get("preview-service").invoke("setObjectProperty", ownerModuleId, label, propertyName, propertyValue, propertyType);
        }
    },

    setPreviewObjectLabel: {
        value: function(previewId, ownerModuleId, label, newLabel) {
            return this.backend.get("preview-service").invoke("setObjectLabel", ownerModuleId, label, newLabel);
        }
    },

    setPreviewObjectBinding: {
        value: function(previewId, ownerModuleId, label, binding) {
            return this.backend.get("preview-service").invoke("setObjectBinding", ownerModuleId, label, binding);
        }
    },

    deletePreviewObjectBinding: {
        value: function(previewId, ownerModuleId, label, path) {
            return this.backend.get("preview-service").invoke("deleteObjectBinding", ownerModuleId, label, path);
        }
    },

    addTemplateFragment: {
        value: function(previewId, moduleId, elementLocation, how, templateFragment) {
            return this.backend.get("preview-service").invoke("addTemplateFragment", moduleId, elementLocation, how, templateFragment);
        }
    },

    addTemplateFragmentObjects: {
        value: function(previewId, moduleId, templateFragment) {
            return this.backend.get("preview-service").invoke("addTemplateFragmentObjects", moduleId, templateFragment);
        }
    },

    setPreviewElementAttribute: {
        value: function(previewId, moduleId, elementLocation, attributeName, attributeValue) {
            return this.backend.get("preview-service").invoke("setElementAttribute", moduleId, elementLocation, attributeName, attributeValue);
        }
    },

    setPreviewObjectTemplate: {
        value: function(previewId, moduleId, templateFragment) {
            return this.backend.get("preview-service").invoke("setObjectTemplate", moduleId, templateFragment);
        }
    },

    addPreviewObjectEventListener: {
        value: function(previewId, moduleId, label, type, listenerLabel, useCapture) {
            return this.backend.get("preview-service").invoke("addObjectEventListener", moduleId, label, type, listenerLabel, useCapture);
        }
    },

    removePreviewObjectEventListener: {
        value: function(previewId, moduleId, label, type, listenerLabel, useCapture) {
            return this.backend.get("preview-service").invoke("removeObjectEventListener", moduleId, label, type, listenerLabel, useCapture);
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

    _userController: {
        value: null
    },

    userController: {
        get: function() {
            if (!this._userController) {
                this._userController = new UserController().init();
            }

            return this._userController;
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

    writeFile: {
        value: function(url, data) {
            return this.backend.get("file-service").invoke("writeFile", url, data);
        }
    },

    remove: {
        value: function (url) {
            return this.backend.get("file-service").invoke("remove", url);
        }
    },

    makeTree: {
        value: function (url) {
            return this.backend.get("file-service").invoke("makeTree", url);
        }
    },

    removeTree: {
        value: function (url) {
            return this.backend.get("file-service").invoke("removeTree", url);
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
        value: function () {
            return this.backend.get("repository-service").invoke("listBranches");
        }
    },

    checkoutShadowBranch: {
        value: function (branch) {
            return this.backend.get("repository-service").invoke("checkoutShadowBranch", branch);
        }
    },

    commitFiles: {
        value: function (files, message, resolutionStrategy) {
            return this.backend.get("repository-service").invoke("commitFiles", files, message, resolutionStrategy);
        }
    },

    updateRepositoryReferences: {
        value: function (resolutionStrategy) {
            return this.backend.get("repository-service").invoke("updateRefs", resolutionStrategy);
        }
    }
});
