var log = require("./common/logging").from(__filename);
var track = require("./common/track");
var request = require("q-io/http").request;
var Q = require("q");
var ProjectInfo = require("./project-info");
var GithubService = require("./github-service").GithubService;
var environment = require("./common/environment");

var IMAGE_NAME = "firefly_project:" + (process.env.PROJECT_VERSION || "latest");
var IMAGE_PORT = 2441;
var IMAGE_PORT_TCP = IMAGE_PORT + "/tcp";

var containerNameForProjectInfo = function (projectInfo) {
    return "firefly-project_" + projectInfo.username + "_" + projectInfo.owner + "_" + projectInfo.repo;
};

var containerHasName = function (nameOrMatcher, containerInfo) {
    return containerInfo && containerInfo.Names.filter(function (name) {
        if (typeof nameOrMatcher === "function") {
            return nameOrMatcher(name);
        } else {
            return name === nameOrMatcher;
        }
    }).length > 0;
};

var isContainerForProjectInfo = function (projectInfo, containerInfo) {
    return containerHasName(containerInfo, containerNameForProjectInfo(projectInfo));
};

var getExposedPort = function (containerInfo) {
    if (containerInfo && containerInfo.NetworkSettings && containerInfo.NetworkSettings.Ports) {
        return containerInfo.NetworkSettings.Ports[IMAGE_PORT_TCP][0].HostPort;
    } else {
        throw new Error("Cannot get exposed port, containerInfo keys: " + Object.keys(containerInfo.State).join(", "));
    }
};

module.exports = UserStackManager;
function UserStackManager(docker, _request) {
    this.docker = docker;
    this.pendingContainers = new Map();
    this.GithubService = GithubService;
    // Only used for testing
    this.request = _request || request;
}

UserStackManager.prototype.has = function (info) {
    return this.docker.listContainers()
        .then(function (containerInfos) {
            return containerInfos.filter(isContainerForProjectInfo.bind(null, info)).length > 0;
        });
};

UserStackManager.prototype.containersForUser = function (githubUsername) {
    var self = this;
    return this.docker.listContainers()
        .then(function (containerInfos) {
            return containerInfos.filter(containerHasName.bind(null, function (name) {
                return name.indexOf("firefly-project_" + githubUsername) === 0;
            })).map(function (containerInfo) {
                return new self.docker.Container(self.docker.modem, containerInfo.Id);
            });
        });
};

UserStackManager.prototype.setup = function (info, githubAccessToken, githubProfile) {
    var self = this;

    if (!(info instanceof ProjectInfo)) {
        throw new TypeError("Given info was not an instance of ProjectInfo");
    }

    return this.docker.listContainers()
        .then(function (containerInfos) {
            var existingContainer = containerInfos.filter(isContainerForProjectInfo.bind(null, info))[0];
            if (existingContainer) {
                return new self.docker.Container(self.docker.modem, existingContainer.Id);
            } else if (self.pendingContainers.has(info)) {
                return self.pendingContainers.get(info);
            } else if (githubAccessToken && githubProfile) {
                var promise = self.create(info, githubAccessToken, githubProfile);
                self.pendingContainers.set(info, promise);
                return promise;
            } else {
                throw new Error("Container does not exist and no github credentials given to create it.");
            }
        })
        .then(function (container) {
            return container.inspect()
                .then(function (containerInfo) {
                    return self.waitForProjectServer(getExposedPort(containerInfo));
                })
                .catch(function (error) {
                    log("Removing stack for", info.toString(), "because", error.message);
                    return container.remove()
                        .then(function () {
                            track.errorForUsername(error, info.username, {info: info});
                            throw error;
                        }, function (error) {
                            track.errorForUsername(error, info.username, {info: info});
                        });
                });
        });
};

UserStackManager.prototype.buildOptionsForProjectInfo = function (info, githubAccessToken, githubProfile) {
    var projectConfig = {
        username: info.username,
        owner: info.owner,
        repo: info.repo,
        githubAccessToken: githubAccessToken,
        githubUser: githubProfile,
        subdomain: info.toPath()
    };
    var options = {
        Name: containerNameForProjectInfo(info),
        Image: IMAGE_NAME,
        Memory: 256 * 1024 * 1024,
        MemorySwap: 256 * 1024 * 1024,
        Cmd: ['-c', JSON.stringify(projectConfig)],
        Env: [
            "NODE_ENV=" + (process.env.NODE_ENV || "development"),
            "FIREFLY_APP_URL=" + environment.app.href,
            "FIREFLY_PROJECT_URL=" + environment.project.href,
            "FIREFLY_PROJECT_SERVER_COUNT=" + environment.projectServers
        ],
        PortBindings: {}
    };
    options.PortBindings[IMAGE_PORT_TCP] = [ {HostIp: "127.0.0.1"} ];
    return options;
};

UserStackManager.prototype.create = function (info, githubAccessToken, githubProfile) {
    var self = this;
    return this._getRepoPrivacy(info, githubAccessToken)
        .then(function (isPrivate) {
            if (isPrivate) {
                info.setPrivate(true);
            }

            log("Creating project container for", info.toString(), "...");
            track.messageForUsername("create container", info.username, {info: info});

            var options = self.buildOptionsForProjectInfo(info, githubAccessToken, githubProfile);
            return self.docker.createContainer(options)
                .then(function (container) {
                    log("Created container", container.id, "for", info.toString());
                    log("Starting container", container.id);
                    return container.start({})
                        .then(function () {
                            return container;
                        });
                });
        });
};

/**
 * Waits for a server to be available on the given port. Retries every
 * 100ms until timeout passes.
 * @param  {string} port         The exposed port of the container
 * @param  {number} [timeout]   The number of milliseconds to keep trying for
 * @param  {Error} [error]      An previous error that caused the timeout
 * @return {Promise.<string>}   A promise for the port resolved when the
 * server is available.
 */
UserStackManager.prototype.waitForProjectServer = function (port, timeout, error) {
    var self = this;

    timeout = typeof timeout === "undefined" ? 5000 : timeout;
    if (timeout <= 0) {
        return Q.reject(new Error("Timeout while waiting for server on port " + port + (error ? " because " + error.message : "")));
    }

    return self.request({
        host: "127.0.0.1",
        port: port,
        method: "OPTIONS",
        path: "/check"
    })
    .catch(function (error) {
        log("Server at", port, "not available yet. Trying for", timeout - 100, "more ms");
        return Q.delay(100).then(function () {
            return self.waitForProjectServer(port, timeout - 100, error);
        });
    })
    .thenResolve(port);
};

UserStackManager.prototype.delete = function (info) {
    var self = this;
    return this.listContainers()
        .then(function (containerInfos) {
            var containerInfo = containerInfos.filter(isContainerForProjectInfo.bind(null, info))[0];
            var container = new self.docker.Container(self.docker.modem, containerInfo.Id);
            return container.stop()
                .then(function () {
                    return container.remove();
                });
        });
};

UserStackManager.prototype.deleteUserContainers = function (githubUsername) {
    return this.containersForUser()
        .then(function (containers) {
            return Promise.all(containers.map(function (container) {
                return container.stop()
                    .then(function () {
                        return container.remove();
                    });
            }));
        });
};

UserStackManager.prototype._getRepoPrivacy = function(info, githubAccessToken) {
    if (typeof info.private === 'undefined' && githubAccessToken) {
        var githubService = new this.GithubService(githubAccessToken);
        return githubService.getRepo(info.owner, info.repo).then(function(repoInfo) {
            return Q.resolve(repoInfo.private);
        });
    } else {
        return Q.resolve(info.private);
    }
};
