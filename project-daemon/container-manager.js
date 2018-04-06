var log = require("./common/logging").from(__filename);
var track = require("./common/track");
var request = require("q-io/http").request;
var Q = require("q");
var environment = require("./common/environment");
var ProjectInfo = require("./common/project-info");
var GithubService = require("./common/github-service").GithubService;
var Map = require("collections/map");

var IMAGE_PORT = 2441;

module.exports = ContainerManager;
function ContainerManager(docker, services, _request) {
    this.docker = docker;
    this.services = services;
    this.pending = new Map();
    this.GithubService = GithubService;
    // Only used for testing
    this.request = _request || request;
}

ContainerManager.prototype.setup = function (info, githubAccessToken, githubUser) {
    var self = this;

    if (!(info instanceof ProjectInfo)) {
        throw new Error("Given info was not an instance of ProjectInfo");
    }

    var service = self.services.get(info);
    if (!service && (!githubAccessToken || !githubUser)) {
        return Q(false);
    }

    var setup = this.pending.get(info);
    if (!setup) {
        setup = this.get(info)
        .then(function (service) {
            return service || self.create(info, githubAccessToken, githubUser);
        })
        .then(function (service) {
            return self.waitForServer(info.url);
        })
        .catch(function (error) {
            log("Removing container for", info.toString(), "because", error.message);

            return self.delete(info)
            .catch(function (error) {
                track.errorForUsername(error, info.username, {info: info});
            })
            .then(function () {
                track.errorForUsername(error, info.username, {info: info});
                throw error;
            });
        })
        .then(function (url) {
            self.pending.delete(info);
            return url;
        });

        this.pending.set(info, setup);
    }
    return setup;
};

ContainerManager.prototype.delete = function (info) {
    var self = this;
    return Q.resolve(this.services.get(info))
    .then(function (service) {
        return service.remove();
    })
    .finally(function () {
        self.services.delete(info);
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

/**
 * Gets a service for the given user/owner/repo combo. If the requested service
 * is not cached, the manager tries to find a matching service from docker service
 * ls. Another project daemon in the stack could have already created an appropriate
 * container.
 * @param  {string} user  The currently logged in username
 * @param  {string} owner The owner of the repo
 * @param  {string} repo  The name of the repo
 * @return {Promise.<Object>} An object of information about the service
 */
ContainerManager.prototype.get = function (info) {
    var self = this;
    var service = self.services.get(info);
    if (service) {
        return Q(service);
    }
    var discover = this.docker.listServices()
    .then(function (services) {
        var existingService = services.filter(function (s) {
            return s.Spec && s.Spec.Name === info.serviceName;
        })[0];
        if (existingService) {
            log("Discovered an existing service for", info.toString(), "that was created by another daemon in the swarm");
            existingService.name = info.serviceName;
            self.services.set(info, existingService);
            return existingService;
        }
    });
    return discover;
};

ContainerManager.prototype.create = function (info, githubAccessToken, githubUser) {
    var self = this;
    var pending = this._getRepoPrivacy(info, githubAccessToken)
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
            service.name = info.serviceName;
            self.services.set(info, service);
            return service;
        });

    this.pending.set(info, pending);
    return pending;
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
