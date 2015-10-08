/* global XMLHttpRequest */
var Montage = require("montage").Montage;
var Promise = require("montage/core/promise").Promise;
var github = require("./github");

/**
 * The functions provided by this file should be converted into a service.
 * Everything that requires a session token should definitely be provided by
 * the backend to avoid exposing the token to the client ever.
 * However, we can still offload some of the git related work to the client
 * if the repository we're working with is public.
 *
 * It's also worth considering splitting the services provided by this file into
 * two: project related operations and git repo related operations.
 * It's possible that we need information on a particular git repo that isn't
 * a project.
 */

exports.RepositoryController = Montage.specialize({
    owner: {
        value: null
    },

    repo: {
        value: null
    },

    _isNonEmptyRepository: {
        value: null
    },

    constructor: {
        value: function RepositoryController() {

        }
    },

    init: {
        value: function(owner, repo) {
            this.owner = owner;
            this.repo = repo;

            return this;
        }
    },

    initializeRepositoryWorkspace: {
        value: function() {
            var self = this;
            var done = Promise.defer();

            return this._request({
                method: "POST",
                url: "/api/" + this.owner + "/" + this.repo + "/init"
            }).then(function () {
                function poll() {
                    self._request({
                        method: "GET",
                        url: "/api/" + self.owner + "/" + self.repo + "/init/progress"
                    })
                    .then(function (message) {
                        if (message.state === "pending") {
                            setTimeout(poll, 5000);
                        } else if (message.state === "fulfilled") {
                            done.resolve();
                        } else if (message.state === "rejected") {
                            done.reject(new Error("Initialize failed"));
                        }
                    }).catch(done.reject);
                }

                poll();

                return done.promise;
            });
        }
    },

    isRepositoryEmpty: {
        value: function() {
            var self = this,
                emptynessPromise;

            if (this._isNonEmptyRepository) {
                emptynessPromise = Promise.resolve(false);
            } else {
                emptynessPromise = github.githubApi()
                    .then(function(githubApi) {
                        return githubApi.isRepositoryEmpty(self.owner, self.repo);
                    });
            }

            return emptynessPromise;
        }
    },

    isMontageRepository: {
        value: function() {
            var self = this;
            return github.githubFs(this.owner, this.repo)
                .then(function(githubFs) {
                    return githubFs.readFromDefaultBranch('/package.json')
                        .then(function(content) {
                            self._isNonEmptyRepository = true;
                            if (content) {
                                try {
                                    var packageDescription = JSON.parse(content);
                                    return packageDescription.dependencies && "montage" in packageDescription.dependencies;
                                } catch(ex) {
                                    // not a JSON file
                                    return false;
                                }
                            } else {
                                return false;
                            }
                        }, function() {
                            return false;
                        });
                });
        }
    },

    repositoryExists: {
        value: function() {
            var self = this;

            return github.githubApi()
            .then(function(githubApi) {
                return githubApi.repositoryExists(self.owner, self.repo);
            });
        }
    },

    getRepositoryUrl: {
        value: function() {
            var self = this;

            return github.githubApi()
            .then(function(githubApi) {
                return githubApi.getRepository(self.owner, self.repo);
            })
            .then(function(repo) {
                // jshint -W106
                return repo.html_url;
                // jshint +W106
            });
        }
    },

    workspaceExists: {
        value: function() {
            return this._request({
                method: "GET",
                url: "/api/" + this.owner + "/" + this.repo + "/workspace"
            })
            .then(function(message) {
                return message.created;
            });
        }
    },

    createComponent: {
        value: function(name, packageHome, destination) {
            return this._request({
                method: "POST",
                url: "/api/" + this.owner + "/" + this.repo + "/components",
                data: {
                    "name": name,
                    "packageHome": packageHome,
                    "destination": destination
                }
            });
        }
    },

    createModule: {
        value: function(name, extendsModuleId, extendsName, destination) {
            return this._request({
                method: "POST",
                url: "/api/" + this.owner + "/" + this.repo + "/modules",
                data: {
                    "name": name,
                    "extendsModuleId": extendsModuleId,
                    "extendsName": extendsName,
                    "destination": destination
                }
            });
        }
    },

    saveFile: {
        value: function(filename, contents) {
            return this._request({
                method: "POST",
                url: "/api/" + this.owner + "/" + this.repo + "/save",
                data: {
                    "filename": filename,
                    "contents": contents
                }
            });
        }
    },

    flush: {
        value: function(message) {
            return this._request({
                method: "POST",
                url: "/api/" + this.owner + "/" + this.repo + "/flush",
                data: {
                    message: message
                }
            });
        }
    },

    _request: {
        value: function(request) {
            var xhr = new XMLHttpRequest(),
                deferred = Promise.defer();

            xhr.open(request.method, request.url);
            // IE has a bug that requires withCredentials (or other XHR
            // properties like responseType) to be set after open() is
            // called.
            // http://connect.microsoft.com/IE/feedback/details/795580
            if (request.withCredentials) {
                xhr.withCredentials = true;
            }
            xhr.addEventListener("load", function() {
                var message;

                if (xhr.status >= 200 && xhr.status < 300) {
                    if (xhr.responseText) {
                        try {
                            message = JSON.parse(xhr.responseText);
                        } catch (ex) {
                            deferred.reject(ex.message);
                        }
                    }
                    deferred.resolve(message);
                } else {
                    deferred.reject(xhr);
                }
            }, false);
            xhr.addEventListener("error", function() {
                deferred.reject(xhr);
            }, false);

            if (request.data) {
                xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
                xhr.send(JSON.stringify(request.data));
            } else {
                xhr.send();
            }

            return deferred.promise;
        }
    }
});
