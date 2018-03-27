/*jshint browser:true */
var Target = require("montage/core/target").Target,
    Promise = require("montage/core/promise").Promise,
    Connection = require("q-connection"),
    adaptConnection = require("q-connection/adapt"),
    FileDescriptor = require("./file-descriptor").FileDescriptor,
    MenuItem = require("core/menu-item").MenuItem,
    mainMenu = require("core/menu").defaultMenu,
    userMenu = require("core/menu").userMenu,
    RepositoryController = require("adaptor/client/core/repository-controller").RepositoryController,
    UserController = require("adaptor/client/core/user-controller").UserController,
    URL = require("core/url"), // jshint ignore:line
    track = require("track");

// TODO we should only inject the base prototype of generic services this environment provides
// the hosted application may build on top of that with specific features it needs of the bridge
// i.e. we shouldn't expect the environment bridge the host provides to know about the needs of all potential guests

exports.EnvironmentBridge = Target.specialize({

    constructor: {
        value: function EnvironmentBridge() {
            this.super();
            this._serviceCache = {};
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

    MenuItem: {
        value: MenuItem
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

    _connection: {
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
                var connection = self._connection = adaptConnection(new WebSocket(protocol + "//" + window.location.host + window.location.pathname));

                connection.closed.then(function () {
                    self._connection = null;
                    self.dispatchBeforeOwnPropertyChange("backend", self._backend);
                    self._backend = null;
                    self._serviceCache.clear();
                    self.dispatchOwnPropertyChange("backend", self._backend);
                }).done();

                self.dispatchBeforeOwnPropertyChange("backend", self._backend);
                self._backend = Connection(connection, this._frontendService, {
                    capacity: 4096,
                    onmessagelost: function (message) {
                        window.console.warn("message to unknown promise", message);
                        track.error(new Error("message to unknown promise: " + JSON.stringify(message)));
                    }
                });
                self.dispatchOwnPropertyChange("backend", self._backend);

                self._backend.done();

                // every 20 seconds
                this._startPing(20000);
            }

            return self._backend;
        }
    },

    _serviceCache: {
        value: null
    },

    getService: {
        value: function (name) {
            if (!this._serviceCache[name]) {
                this._serviceCache[name] = this.backend.get(name);
            }

            return this._serviceCache[name];
        }
    },

    _pingTimeout: {
        value: null
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
                    .timeout(5000)
                    .then(function () {
                        clearTimeout(self._pingTimeout);
                        self._pingTimeout = setTimeout(ping, delay);
                    }, function (error) {
                        track.error(error);
                        // If the ping fails but we still have a connection
                        // then something has gone wrong. Best we just close
                        // this connection, stop pinging and let the backend
                        // getter recover
                        clearTimeout(self._pingTimeout);
                        self._pingTimeout = null;
                        if (self._connection) {
                            self._connection.close();
                        }
                    });
                }
            };

            // If pinging has already been setup, then don't kick it off again
            if (!this._pingTimeout) {
                // Set to true to make sure we don't start two pings before
                // the first one has responded to set the timeout handle
                this._pingTimeout = true;
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
                this._packageUrl = this.getService("env-service").get("projectUrl")
                .then(function (url) {
                    // The PreviewController depends on this changing
                    self.dispatchOwnPropertyChange("previewUrl", self.previewUrl);
                    self._patchXhr(url);

                    return url;
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
                    var result = open.apply(this, arguments);
                    // IE has a bug that requires withCredentials (or other XHR
                    // properties like responseType) to be set after open() is
                    // called.
                    // http://connect.microsoft.com/IE/feedback/details/795580
                    if (url.indexOf(withCredentialsUrl) !== -1) {
                        this.withCredentials = true;
                    }
                    return result;
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

    read: {
        value: function (url) {
            return this.getService("file-service").invoke("read", url);
        }
    },

    _extractDependenciesFromPackage: {
        value: function (packageUrl, packageInfo) {
            var dependencyNames = Object.keys(packageInfo.dependencies);

            //TODO implement mapping in addition to just dependencies
            //TODO also report the version of the dependency
            return dependencyNames.map(function (dependencyName) {
                return {
                    "dependency": dependencyName,
                    "url": packageUrl + "node_modules/" + dependencyName,
                    "version": packageInfo.dependencies[dependencyName]
                };
            });
        }
    },

    dependenciesInPackage: {
        value: function (packageUrl) {
            var self = this;

            return this.getService("file-service").invoke("read", packageUrl + "/package.json")
                .then(function (content) {
                    var packageInfo = JSON.parse(content),
                        dependencies;

                    if (packageInfo.dependencies) {
                        dependencies = self._extractDependenciesFromPackage(packageUrl, packageInfo);
                    } else {
                        dependencies = [];
                    }

                    return dependencies;
                });
        }
    },

    previewUrl: {
        get: function () {
            var url, urlObject;

            // Don't indirectly kick off a connection to the backend, because
            // this must be delayed until the local clone exists
            if (this._packageUrl) {

                url = this._packageUrl.inspect().value;

                if (url) {
                    // We currently force the preview to be over http
                    // to avoid the common issue of applications relying on http services
                    // TODO accept https if the project demands it
                    urlObject = URL.parse(url);
                    // TODO: This should probably be https, check how this works in prod
                    urlObject.protocol = "http:";
                    urlObject = URL.resolve(urlObject, "index.html");
                    url = URL.format(urlObject);

                    return url || void 0;
                }
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
            return this.getService("file-service").invoke("listTree", url, exclude).then(function (fileDescriptors) {
                return fileDescriptors.map(function (fd) {
                    return new FileDescriptor().initWithUrlAndStat(fd.url, fd.stat);
                });
            });
        }
    },

    list: {
        value: function (url) {
            return this.getService("file-service").invoke("list", url).then(function (fileDescriptors) {
                return fileDescriptors.map(function (fd) {
                    return new FileDescriptor().initWithUrlAndStat(fd.url, fd.stat);
                });
            });
        }
    },

    listAssetAtUrl: {
        value: function (url, exclude) {
            return this.getService("file-service").invoke("listAsset", url, exclude).then(function (fileDescriptors) {
                return fileDescriptors.map(function (fd) {
                    var fileDescriptor = new FileDescriptor().initWithUrlAndStat(fd.url, fd.stat);
                    fileDescriptor.mimeType = fd.mimeType;

                    return fileDescriptor;
                });
            });
        }
    },

    detectMimeTypeAtUrl: {
        value: function (url) {
            return this.getService("file-service").invoke("detectMimeTypeAtUrl", url);
        }
    },

    watch: {
        value: function (url, ignoreSubPaths, changeHandler, errorHandler) {
            var handlers = {
                handleChange: changeHandler,
                handleError: errorHandler
            };

            var result = this.getService("file-service").invoke("watch", url, ignoreSubPaths, handlers);

            // rewatch when the backend websocket reconnects
            this.addOwnPropertyChangeListener("backend", function (backend, key, self) {
                if (backend) {
                    self.getService("file-service").invoke("watch", url, ignoreSubPaths, handlers).done();
                }
            });

            return result;
        }
    },

    getExtensionsAt: {
        value: function (url) {
            return this.getService("file-service").invoke("listPackage", url, true).then(function (fileDescriptors) {
                return fileDescriptors.filter(function (fd) {
                    return (/\.filament-extension\/$/).test(fd.url);
                }).map(function (fd) {
                    return fd.url;
                });
            });
        }
    },

    componentsInPackage: {
        value: function (url) {
            return this.getService("file-service").invoke("listPackage", url, true).then(function (fileDescriptors) {
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
            return this.getService("preview-service").invoke("register");
        }
    },

    unregisterPreview: {
        value: function () {
            var self = this;

            // If the websocket isn't connected don't trigger a reconnect
            if (this._backend) {
                return this.getService("preview-service").invoke("unregister")
                .then(function() {
                    self._previewUrl = null;
                });
            } else {
                return Promise();
            }
        }
    },

    getPreviewClients: {
        value: function() {
            return this.getService("preview-service").invoke("getClients");
        }
    },

    launchPreview: {
        value: function () {
            return Promise.resolve();
        }
    },

    refreshPreview: {
        value: function () {
            return this.getService("preview-service").invoke("refresh");
        }
    },

    selectPreviewComponentToInspect: {
        value: function(previewId, clientId) {
            return this.getService("preview-service").invoke("selectComponentToInspect", clientId);
        }
    },

    setPreviewObjectProperties: {
        value: function(previewId, label, ownerModuleId, properties) {
            return this.getService("preview-service").invoke("setObjectProperties", label, ownerModuleId, properties);
        }
    },

    setPreviewObjectProperty: {
        value: function(previewId, ownerModuleId, label, propertyName, propertyValue, propertyType) {
            return this.getService("preview-service").invoke("setObjectProperty", ownerModuleId, label, propertyName, propertyValue, propertyType);
        }
    },

    setPreviewObjectLabel: {
        value: function(previewId, ownerModuleId, label, newLabel) {
            return this.getService("preview-service").invoke("setObjectLabel", ownerModuleId, label, newLabel);
        }
    },

    setPreviewObjectBinding: {
        value: function(previewId, ownerModuleId, label, binding) {
            return this.getService("preview-service").invoke("setObjectBinding", ownerModuleId, label, binding);
        }
    },

    deletePreviewObjectBinding: {
        value: function(previewId, ownerModuleId, label, path) {
            return this.getService("preview-service").invoke("deleteObjectBinding", ownerModuleId, label, path);
        }
    },

    addTemplateFragment: {
        value: function(previewId, moduleId, elementLocation, how, templateFragment) {
            return this.getService("preview-service").invoke("addTemplateFragment", moduleId, elementLocation, how, templateFragment);
        }
    },

    addTemplateFragmentObjects: {
        value: function(previewId, moduleId, templateFragment) {
            return this.getService("preview-service").invoke("addTemplateFragmentObjects", moduleId, templateFragment);
        }
    },

    deletePreviewObject: {
        value: function(previewId, ownerModuleId, label) {
            return this.getService("preview-service").invoke("deleteObject", ownerModuleId, label);
        }
    },

    deletePreviewElement: {
        value: function(previewId, ownerModuleId, elementLocation) {
            return this.getService("preview-service").invoke("deleteElement", ownerModuleId, elementLocation);
        }
    },

    setPreviewElementAttribute: {
        value: function(previewId, moduleId, elementLocation, attributeName, attributeValue) {
            return this.getService("preview-service").invoke("setElementAttribute", moduleId, elementLocation, attributeName, attributeValue);
        }
    },

    addPreviewObjectEventListener: {
        value: function(previewId, moduleId, label, type, listenerLabel, useCapture) {
            return this.getService("preview-service").invoke("addObjectEventListener", moduleId, label, type, listenerLabel, useCapture);
        }
    },

    removePreviewObjectEventListener: {
        value: function(previewId, moduleId, label, type, listenerLabel, useCapture) {
            return this.getService("preview-service").invoke("removeObjectEventListener", moduleId, label, type, listenerLabel, useCapture);
        }
    },

    updatePreviewCssFileContent: {
        value: function(previewId, url, content) {
            return this.getService("preview-service").invoke("updateCssFileContent", url, content);
        }
    },

    setDocumentDirtyState: {
        value: function () {
        }
    },

    availableExtensions: {
        get: function () {
            return this.getService("extension-service").invoke("getExtensions");
        }
    },

    listLibraryItemUrls: {
        value: function (extensionUrl, packageName) {
            return this.getService("extension-service").invoke("listLibraryItemUrls", extensionUrl, packageName);
        }
    },

    listModuleIconUrls: {
        value: function (extensionUrl, packageName) {
            return this.getService("extension-service").invoke("listModuleIconUrls", extensionUrl, packageName);
        }
    },

    loadLibraryItemJson: {
        value: function(libraryItemJsonUrl) {
            return this.getService("extension-service").invoke("loadLibraryItemJson", libraryItemJsonUrl);
        }
    },

    promptForSave: {
        value: function (options) {
            var self = this;
            return this.packageUrl.then(function (packageUrl) {
                var appDelegate = self.applicationDelegate,
                    prefix;

                if (options.defaultDirectory === packageUrl) {
                    prefix = "/";
                }
                else {
                    prefix = options.defaultDirectory.replace(packageUrl, "").replace(/([^/])$/, "$1/");
                }
                appDelegate.currentPanelKey = "prompt";
                appDelegate.showModal = true;
                return self.promptPanel.getResponse(options.prompt, options.defaultName, options.submitLabel, null, prefix).then(function (response) {
                    //TODO sanitize input
                    if (response) {
                        response = options.defaultDirectory + "/" + response;
                    }
                    appDelegate.showModal = false;
                    appDelegate.currentPanelKey = null;
                    return response;
                });
            });
        }
    },

    openHttpUrl: {
        value: function (url) {
            var deferredWindow = Promise.defer(),
                newWindow = window.open();

            // Prevent new window from having a reference to this window, this
            // will put the new window in a new process.
            // https://code.google.com/p/chromium/issues/detail?id=153363
            newWindow.opener = null;
            newWindow.location.href = url;

            if (newWindow) {
                deferredWindow.resolve();
            } else {
                deferredWindow.reject( new Error("Failed to open window to " + url));
            }

            return deferredWindow.promise;
        }
    },

    createComponent: {
        value: function (name, packageHome, destination) {
            return this.repositoryController.createComponent(name, packageHome, destination).then(function(response) {
                if (response.error) {
                    throw new Error(response.error);
                }

                return URL.parse(name).pathname;
            });
        }
    },

    createModule: {
        value: function (name, packageHome, destination) {
            return this.repositoryController.createModule(name, undefined, undefined, destination).then(function(response) {
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

    userMenu: {
        get: function () {
            return userMenu;
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

    workspaceExists: {
        value: function() {
            return this.repositoryController.workspaceExists();
        }
    },

    /**
     * open a new commit batch
     */
    openCommitBatch: {
        value: function(message) {
            return this.getService("repository-service").invoke("openCommitBatch", message);
        }
    },

    /**
     * stage files on specified commit batch
     */
    stageFiles: {
        value: function(commitBatch, urls) {
            return commitBatch.invoke("stageFiles", urls);
        }
    },

    /**
     * stage files for deletion on specified commit batch
     */
    stageFilesForDeletion: {
        value: function(commitBatch, urls) {
            return commitBatch.invoke("stageFilesForDeletion", urls);
        }
    },

    /**
     * close a commit batch and commit all staged files
     */
    closeCommitBatch: {
        value: function(commitBatch, message) {
            return commitBatch.invoke("commit", message);
        }
    },

    /**
     * delete a commit batch without commiting
     */
    releaseCommitBatch: {
        value: function(commitBatch) {
            return commitBatch.invoke("release");
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
            return this.getService("file-service").invoke("writeFile", url, data);
        }
    },

    remove: {
        value: function (url) {
            return this.getService("file-service").invoke("remove", url);
        }
    },

    makeTree: {
        value: function (url) {
            return this.getService("file-service").invoke("makeTree", url);
        }
    },

    makeTreeWriteFile: {
        value: function (url, data) {
            return this.getService("file-service").invoke("makeTreeWriteFile", url, data);
        }
    },

    removeTree: {
        value: function (url) {
            return this.getService("file-service").invoke("removeTree", url);
        }
    },

    touch: {
        value: function (url) {
            return this.getService("file-service").invoke("touch", url);
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
            return editingDocument.save(location);
        }
    },

    didSaveProject: {
        value: function() {
            return this.getService("preview-service").invoke("didSaveProject");
        }
    },

    listDependenciesAtUrl: {
        value: function (packageUrl) {
            return this.getService("package-manager-service").invoke("listDependenciesAtUrl", packageUrl);
        }
    },

    removePackage: {
        value: function (packageName) {
            return this.getService("package-manager-service").invoke("removePackage", packageName);
        }
    },

    findOutdatedDependency: {
        value: function () {
            return this.getService("package-manager-service").invoke("findOutdatedDependency");
        }
    },

    installPackages: {
        value: function (requestedPackages) {
            return this.getService("package-manager-service").invoke("installPackages", requestedPackages);
        }
    },

    gatherPackageInformation: {
        value: function (requestedPackage) {
            return this.getService("package-manager-service").invoke("gatherPackageInformation", requestedPackage);
        }
    },

    searchPackages: {
        value: function (packages) {
            return this.getService("package-manager-service").invoke("searchPackages", packages);
        }
    },

    installProjectPackages: {
        value: function (packages) {
            return this.getService("package-manager-service").invoke("installProjectPackages");
        }
    },

    buildOptimize: {
        value: function (options) {
            return this.getService("build-service").invoke("optimize", options);
        }
    },

    buildArchive: {
        value: function () {
            return this.getService("build-service").invoke("archive");
        }
    },

    buildPublishToGithubPages: {
        value: function () {
            return this.getService("build-service").invoke("publishToGithubPages");
        }
    },

    downloadFile: {
        value: function(fileUrl) {
            var link = this.applicationDelegate.downloadLink;
            var event = document.createEvent("MouseEvents");

            link.href = fileUrl;
            event.initEvent("click", true, true);
            link.dispatchEvent(event);
        }
    },

    /**
     * Repository functions.
     */
    listRepositoryBranches: {
        value: function () {
            return this.getService("repository-service").invoke("listBranches");
        }
    },

    checkoutShadowBranch: {
        value: function (branch) {
            return this.getService("repository-service").invoke("checkoutShadowBranch", branch);
        }
    },

    shadowBranchStatus: {
        value: function (branch, forceFetch) {
            return this.getService("repository-service").invoke("shadowBranchStatus", branch, forceFetch);
        }
    },

    commitFiles: {
        value: function (fileUrls, message, remove, amend) {
            return this.getService("repository-service").invoke("commitFiles", fileUrls, message, remove, amend);
        }
    },

    updateProjectRefs: {
        value: function (resolutionStrategy, reference, forceFetch) {
            return this.getService("repository-service").invoke("updateRefs", resolutionStrategy, reference, forceFetch);
        }
    },

    mergeShadowBranch: {
        value: function (branch, message, squash, resolutionStrategy) {
            return this.getService("repository-service").invoke("mergeShadowBranch", branch, message, squash, resolutionStrategy);
        }
    },

    resetShadowBranch: {
        value: function (branch) {
            //TODO only do this for shadow branches?
            return this.getService("repository-service").invoke("_reset", branch);
        }
    },

    getRepositoryInfo: {
        value: function (branch) {
            return this.getService("repository-service").invoke("getRepositoryInfo", branch);
        }
    },

    /**
     * Assets converter functions.
     */

    convertColladaToGlTFBundle: {
        value: function (inputUrl, outputUrl) {
            return this.getService("asset-converter-service").invoke("convertColladaAtUrl", inputUrl, {
                bundle: true,
                output: outputUrl
            });
        }
    }

});
