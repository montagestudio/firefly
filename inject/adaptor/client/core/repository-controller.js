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
            return this._request({
                method: "POST",
                url: "/" + this.owner + "/" + this.repo + "/init"
            });
        }
    },

    isRepositoryEmpty: {
        value: function() {
            var self = this;

            return github.githubApi()
            .then(function(githubApi) {
                return githubApi.isRepositoryEmpty(self.owner, self.repo);
            });
        }
    },

    isMontageRepository: {
        value: function() {
            return github.githubFs(this.owner, this.repo)
            .then(function(githubFs) {
                return githubFs.exists("/package.json").then(function(exists) {
                    if (exists) {
                        return githubFs.read("/package.json").then(function(content) {
                            var packageDescription;
                            try {
                                packageDescription = JSON.parse(content);
                            } catch(ex) {
                                // not a JSON file
                                return false;
                            }
                            if (packageDescription.dependencies &&
                                "montage" in packageDescription.dependencies) {
                                return true;
                            } else {
                                return false;
                            }
                        });
                    } else {
                        return false;
                    }
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
                url: "/" + this.owner + "/" + this.repo + "/workspace"
            })
            .then(function(message) {
                return message.created;
            });
        }
    },

    createComponent: {
        value: function(name) {
            return this._request({
                method: "POST",
                url: "/" + this.owner + "/" + this.repo + "/components",
                data: {
                    "name": name
                }
            });
        }
    },

    createModule: {
        value: function(name, extendsModuleId, extendsName) {
            return this._request({
                method: "POST",
                url: "/" + this.owner + "/" + this.repo + "/modules",
                data: {
                    "name": name,
                    "extendsModuleId": extendsModuleId,
                    "extendsName": extendsName
                }
            });
        }
    },

    saveFile: {
        value: function(filename, contents) {
            return this._request({
                method: "PUT",
                url: "/" + this.owner + "/" + this.repo,
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
                url: "/" + this.owner + "/" + this.repo + "/flush",
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

            if (request.withCredentials) {
                xhr.withCredentials = true;
            }

            xhr.open(request.method, request.url);
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
