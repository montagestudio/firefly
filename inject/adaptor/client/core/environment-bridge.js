/*jshint browser:true */
/*global URL:true */
var Montage = require("montage").Montage,
    Promise = require("montage/core/promise").Promise,
    Connection = require("q-connection"),
    adaptConnection = require("q-connection/adapt"),
    FileDescriptor = require("./file-descriptor").FileDescriptor,
    MenuItem = require("core/menu-item").MenuItem,
    mainMenu = require("core/menu").defaultMenu,
    userMenu = require("core/menu").userMenu,
    RepositoryController = require("adaptor/client/core/repository-controller").RepositoryController,
    UserController = require("adaptor/client/core/user-controller").UserController,
    URL = require("core/url"),
    track = require("track");

// TODO we should only inject the base prototype of generic services this environment provides
// the hosted application may build on top of that with specific features it needs of the bridge
// i.e. we shouldn't expect the environment bridge the host provides to know about the needs of all potential guests

exports.EnvironmentBridge = Montage.specialize({

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

    dependenciesInPackage: {
        value: function (packageUrl) {

            return this.getService("file-service").invoke("read", packageUrl + "/package.json")
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
                    return FileDescriptor.create().initWithUrlAndStat(fd.url, fd.stat);
                });
            });
        }
    },

    list: {
        value: function (url) {
            return this.getService("file-service").invoke("list", url).then(function (fileDescriptors) {
                return fileDescriptors.map(function (fd) {
                    return FileDescriptor.create().initWithUrlAndStat(fd.url, fd.stat);
                });
            });
        }
    },

    listAssetAtUrl: {
        value: function (url, exclude) {
            return this.getService("file-service").invoke("listAsset", url, exclude).then(function (fileDescriptors) {
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
            return this.getService("file-service").invoke("detectMimeTypeAtUrl", url);
        }
    },

    watch: {
        value: function (url, ignoreSubPaths, changeHandler, errorHandler) {
            var handlers = {
                handleChange: Promise.master(changeHandler),
                handleError: Promise.master(errorHandler)
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
        value: function () {
            return [];
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

    initializeProject: {
        value: function() {
            var promise = this.repositoryController.initializeRepositoryWorkspace();

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

    workspaceExists: {
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
            var self = this;

            return this.getService("file-service").invoke("writeFile", url, data)
                .then(function () {
                    var path = URL.parse(url).pathname.slice(1);
                    return self.commitFiles([path]);
                })
                .then(function() {
                    return self.flushProject("Add file " + URL.parse(url).pathname);
                });
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

    removeTree: {
        value: function (url) {
            return this.getService("file-service").invoke("removeTree", url);
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
        value: function (branch) {
            return this.getService("repository-service").invoke("shadowBranchStatus", branch);
        }
    },

    commitFiles: {
        value: function (files, message, resolutionStrategy) {
            return this.getService("repository-service").invoke("commitFiles", files, message, resolutionStrategy);
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

    /**
     * Assets converter functions.
     */

    convertColladaToGlTFBundle: {
        value: function (inputUrl, outputUrl) {
            var self = this;

            return this.getService("asset-converter-service").invoke("convertColladaAtUrl", inputUrl, {
                bundle: true,
                output: outputUrl
            }).then(function (assetUrl) {
                var path = URL.parse(assetUrl).pathname.slice(1),
                    parts = path.split('/'),
                    assetName = parts[parts.length - 1];

                return self.commitFiles([path], "Add glTF Bundle: " + assetName).thenResolve(assetUrl);
            });
        }
    }

});
