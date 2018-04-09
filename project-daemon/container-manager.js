var log = require("./common/logging").from(__filename);
var track = require("./common/track");
var request = require("q-io/http").request;
var Q = require("q");
var environment = require("./common/environment");
var ProjectInfo = require("./common/project-info");
var GithubService = require("./common/github-service").GithubService;

var IMAGE_PORT = 2441;

module.exports = ContainerManager;
function ContainerManager(docker, _request) {
    this.docker = docker;
    this.GithubService = GithubService;
    // Only used for testing
    this.request = _request || request;
}

ContainerManager.prototype.list = function (githubUser) {
    return this.docker.listServices()
        .then(function (services) {
            return services.filter(function (service) {
                return service.Spec.TaskTemplate.ContainerSpec.Image.indexOf("firefly/project:") > -1 &&
                    service.Spec.Name.indexOf(githubUser.login) === 0;
            });
        });
};

ContainerManager.prototype.setup = function (info, githubAccessToken, githubUser) {
    var self = this;

    if (!(info instanceof ProjectInfo)) {
        throw new Error("Given info was not an instance of ProjectInfo");
    }

    var service = this.docker.getService(info.serviceName);
    return service.inspect()
        .catch(function (err) {
            if (githubAccessToken && githubUser) {
                return self.create(info, githubAccessToken, githubUser)
                    .then(function (s) {
                        service = s;
                        return service.inspect();
                    });
            }
        })
        .then(function (serviceInfo) {
            if (!serviceInfo) {
                return false;
            }
            return self._waitForRunningTask(serviceInfo)
                .then(function () {
                    return self.waitForServer(info.url);
                })
                .catch(function (error) {
                    log("Removing container for", info.toString(), "because", error.message);

                    return service.remove()
                        .then(function () {
                            track.errorForUsername(error, info.username, {info: info});
                            throw error;
                        }, function (error) {
                            track.errorForUsername(error, info.username, {info: info});
                        });
                });
        });
};

ContainerManager.prototype._waitForRunningTask = function (serviceInfo) {
    var self = this;
    // listTasks() is supposed to be able to take a filter parameter (e.g. to
    // get tasks belonging to a particular service). Can't figure out how this
    // works, there isn't much documentation on its usage
    return this.docker.listTasks()
        .then(function (allTasks) {
            return allTasks.filter(function (task) {
                return task.ServiceID === serviceInfo.ID;
            });
        })
        .then(function (tasks) {
            var runningTasks = tasks.filter(function (task) {
                return task.Status.State === "running";
            });
            if (runningTasks.length === 0) {
                return new Promise(function (resolve) {
                    setTimeout(resolve, 2000);
                }).then(function () {
                    return self._wait(serviceInfo);
                });
            }
        });
};

ContainerManager.prototype.delete = function (info) {
    var service = this.docker.getService(info.serviceName);
    return service.remove();
};

ContainerManager.prototype.deleteAll = function (githubUser) {
    var self = this;
    return this.list(githubUser)
        .then(function (serviceInfos) {
            return Promise.all(serviceInfos.map(function (serviceInfo) {
                var service = self.docker.getService(serviceInfo.Spec.Name);
                return service.remove();
            }));
        });
};

ContainerManager.prototype._getRepoPrivacy = function(info, githubAccessToken) {
    if (typeof info.private === 'undefined' && githubAccessToken) {
        var githubService = new this.GithubService(githubAccessToken);
        return githubService.getRepo(info.owner, info.repo).then(function(repoInfo) {
            return Q.resolve(repoInfo.private);
        });
    } else {
        return Q.resolve(info.private);
    }
};

ContainerManager.prototype.create = function (info, githubAccessToken, githubUser) {
    var self = this;
    return this._getRepoPrivacy(info, githubAccessToken)
        .then(function (isPrivate) {
            if (isPrivate) {
                info.setPrivate(true);
            }

            log("Creating service for", info.toString(), "...");
            track.messageForUsername("create service", info.username, {info: info});

            var subdomain = info.toPath();

            var config = {
                username: info.username,
                owner: info.owner,
                repo: info.repo,
                githubAccessToken: githubAccessToken,
                githubUser: githubUser,
                subdomain: subdomain
            };

            var options = {
                Name: info.serviceName,
                TaskTemplate: {
                    ContainerSpec: {
                        Image: process.env.FIREFLY_PROJECT_IMAGE,
                        Args: ['-c', JSON.stringify(config)],
                        Env: [
                            "NODE_ENV=" + (process.env.NODE_ENV || "development"),
                            "FIREFLY_APP_URL=" + environment.app.href,
                            "FIREFLY_PROJECT_URL=" + environment.project.href,
                            "FIREFLY_PROJECT_SERVER_COUNT=" + environment.projectServers
                        ],
                        Mounts: process.env.USE_SRC_DOCKER_VOLUMES ? [
                            {
                                "ReadOnly": true,
                                "Source": process.env.WORKING_DIR + "/project/",
                                "Target": "/srv/project/",
                                "Type": "bind"
                            }, {
                                "ReadOnly": true,
                                "Source": process.env.WORKING_DIR + "/common/",
                                "Target": "/srv/project/common/",
                                "Type": "bind"
                            }
                        ] : []
                    },
                    Networks: [
                        {
                            "Target": "firefly_net"
                        }
                    ],
                    Placement: {
                        Constraints: process.env.SWARM_SINGLE_NODE ? [] : [
                            "node.role == worker"
                        ]
                    },
                    Resources: {
                        Limits: {
                            // MemoryBytes: 104857600
                        }
                    },
                    RestartPolicy: {
                        Condition: "on-failure",
                        MaxAttempts: 5
                    }
                },
                Mode: {
                    Replicated: {
                        Replicas: 1
                    }
                }
            };

            return self.docker.createService(options);
        })
        .then(function (service) {
            log("Created service", service.id, "for", info.toString());
            return service;
        });
};

/**
 * Waits for a server to be available on the given port. Retries every
 * 100ms until timeout passes.
 * @param  {string} url         The base url of the container
 * @param  {number} [timeout]   The number of milliseconds to keep trying for
 * @param  {Error} [error]      An previous error that caused the timeout
 * @return {Promise.<string>}   A promise for the port resolved when the
 * server is available.
 */
ContainerManager.prototype.waitForServer = function (url, timeout, error) {
    var self = this;

    timeout = typeof timeout === "undefined" ? 5000 : timeout;
    if (timeout <= 0) {
        return Q.reject(new Error("Timeout while waiting for server at " + url + (error ? " because " + error.message : "")));
    }

    return self.request({
        host: url,
        port: IMAGE_PORT,
        method: "OPTIONS",
        path: "/check"
    })
    .catch(function (error) {
        log("Server at", url, "not available yet. Trying for", timeout - 100, "more ms");
        return Q.delay(100).then(function () {
            return self.waitForServer(url, timeout - 100, error);
        });
    })
    .thenResolve(url);
};
