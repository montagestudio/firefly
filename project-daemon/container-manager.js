var log = require("../common/logging").from(__filename);
var track = require("../common/track");
var request = require("q-io/http").request;
var Q = require("q");
var environment = require("../common/environment");
var PreviewDetails = require("./preview-details");
var GithubService = require("../common/github-service").GithubService;

var IMAGE_NAME = "127.0.0.1:5000/project";
var IMAGE_PORT = 2441;

module.exports = ContainerManager;
function ContainerManager(docker, services, subdomainDetailsMap, _request) {
    this.docker = docker;
    this.services = services;
    this.subdomainDetailsMap = subdomainDetailsMap;
    this.GithubService = GithubService;
    // Only used for testing
    this.request = _request || request;
}

ContainerManager.prototype.setup = function (details, githubAccessToken, githubUser) {
    var self = this;

    if (!(details instanceof PreviewDetails)) {
        throw new Error("Given details was not an instance of PreviewDetails");
    }

    var service = self.services.get(details);
    if (!service && (!githubAccessToken || !githubUser)) {
        return Q(false);
    }

    return self.getOrCreate(details, githubAccessToken, githubUser)
    .then(function (service) {
        return self.waitForServer(self.getUrl(details));
    })
    .catch(function (error) {
        log("Removing container for", details.toString(), "because", error.message);

        return self.delete(details)
        .catch(function (error) {
            track.errorForUsername(error, details.username, {details: details});
        })
        .then(function () {
            track.errorForUsername(error, details.username, {details: details});
            throw error;
        });
    });
};

/**
 * Get the base URL of a given container, including address and port.
 * @param  {string} user
 * @param  {string} owner
 * @param  {string} repo
 * @return {string}       The port of the container, or `undefined`
 */
ContainerManager.prototype.getUrl = function (details) {
    return this.services.get(details).name + ':' + IMAGE_PORT;
};

ContainerManager.prototype.delete = function (details) {
    var self = this;
    return Q.resolve(this.services.get(details))
    .then(function (service) {
        return service.remove();
    })
    .finally(function () {
        self.services.delete(details);
    });
};

ContainerManager.prototype._getRepoPrivacy = function(details, githubAccessToken) {
    if (typeof details.private === 'undefined' && githubAccessToken) {
        var githubService = new this.GithubService(githubAccessToken);
        return githubService.getRepo(details.owner, details.repo).then(function(repoInfo) {
            return Q.resolve(repoInfo.private);
        });
    } else {
        return Q.resolve(details.private);
    }
};

/**
 * Gets or creates an container for the given user/owner/repo combo
 * @param  {string} user  The currently logged in username
 * @param  {string} owner The owner of the repo
 * @param  {string} repo  The name of the repo
 * @return {Promise.<Object>} An object of information about the container
 */
ContainerManager.prototype.getOrCreate = function (details, githubAccessToken, githubUser) {
    var self = this;
    var info = self.services.get(details);
    if (!info) {
        var created = this._getRepoPrivacy(details, githubAccessToken)
            .then(function (isPrivate) {
                if (isPrivate) {
                    details.setPrivate(true);
                }

                log("Creating service for", details.toString(), "...");
                track.messageForUsername("create service", details.username, {details: details});

                var subdomain = self.subdomainDetailsMap.subdomainFromDetails(details);

                var config = {
                    username: details.username,
                    owner: details.owner,
                    repo: details.repo,
                    githubAccessToken: githubAccessToken,
                    githubUser: githubUser,
                    subdomain: subdomain
                };

                var options = {
                    Name: serviceName(details),
                    TaskTemplate: {
                        ContainerSpec: {
                            Image: IMAGE_NAME,
                            Args: ['-c', JSON.stringify(config)],
                            Env: [
                                "NODE_ENV=" + (process.env.NODE_ENV || "development"),
                                "FIREFLY_APP_URL=" + environment.app.href,
                                "FIREFLY_PROJECT_URL=" + environment.project.href,
                                "FIREFLY_PROJECT_SERVER_COUNT=" + environment.projectServers
                            ],
                            Mounts: [
                                {
                                    "ReadOnly": true,
                                    "Source": "/firefly",
                                    "Target": "/srv/firefly",
                                    "Type": "bind"
                                }
                            ]
                        },
                        Networks: [
                            {
                                "Target": "firefly_backend"
                            }
                        ],
                        Placement: {
                            Constraints: [
                                "node.role == worker"
                            ]
                        },
                        Resources: {
                            Limits: {
                                // MemoryBytes: 104857600
                            }
                        },
                        RestartPolicy: {
                            Condition: "any",
                            MaxAttempts: 10
                        }
                    },
                    Mode: {
                        Replicated: {
                            Replicas: 1
                        }
                    }
                };

                return self.docker.createService(options)
                    .then(function (service) {
                        log("Created service", service.id, "for", details.toString());
                        service.name = serviceName(details);
                        self.services.set(details, service);
                        return service;
                    });
            });

        self.services.set(details, {created: created});

        return created;
    } else if (info.created && info.created.then) {
        return info.created;
    } else {
        return Q(info);
    }
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

var REPLACE_RE = /[^a-zA-Z0-9\-]/g;
function serviceName(details) {
    // Remove all characters that don't match the RE at the bottom of
    // http://docs.docker.io/en/latest/reference/api/docker_remote_api_v1.10/#create-a-container
    // (excluding "_", because we use that ourselves)
    var username = details.username.replace(REPLACE_RE, "");
    var owner = details.owner.replace(REPLACE_RE, "");
    var repo = details.repo.replace(REPLACE_RE, "");

    return username + "_" + owner + "_" + repo;
}
