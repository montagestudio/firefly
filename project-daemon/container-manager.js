var log = require("logging").from(__filename);
var track = require("./common/track");
var request = require("q-io/http").request;
var Q = require("q");
var ProjectInfo = require("./project-info");
var GithubService = require("./github-service").GithubService;

var IMAGE_NAME = "montagestudio/firefly-project:" + (process.env.PROJECT_VERSION || "latest");
var IMAGE_PORT = 2441;
var IMAGE_PORT_TCP = IMAGE_PORT + "/tcp";
var PROJECTS_NETWORK = "firefly_projects";

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
    return containerHasName(containerNameForProjectInfo(projectInfo), containerInfo);
};

module.exports = ContainerManager;
function ContainerManager(docker, _request) {
    this.docker = docker;
    this.pendingContainers = new Map();
    this.GithubService = GithubService;
    // Only used for testing
    this.request = _request || request;
}

ContainerManager.prototype.has = function (info) {
    return this.docker.listContainers()
        .then(function (containerInfos) {
            return containerInfos.filter(isContainerForProjectInfo.bind(null, info)).length > 0;
        });
};

ContainerManager.prototype.containersForUser = function (githubUsername) {
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

ContainerManager.prototype.hostForProjectInfo = function (projectInfo) {
    return containerNameForProjectInfo(projectInfo) + ":" + IMAGE_PORT;
};

ContainerManager.prototype.setup = function (info, githubAccessToken, githubProfile) {
    var self = this;
    if (!(info instanceof ProjectInfo)) {
        throw new TypeError("Given info was not an instance of ProjectInfo");
    }
    if (this.pendingContainers.has(info.hash)) {
        return this.pendingContainers.get(info.hash);
    }
    var containerPromise = this.getOrCreate(info, githubAccessToken, githubProfile)
        .then(function (container) {
            return self.start(container)
                .then(function (container) {
                    return self.connectToProjectsNetwork(container);
                })
                .then(function (container) {
                    return self.waitForProjectServer(containerNameForProjectInfo(info));
                })
                .catch(function (error) {
                    log("Removing container for", info.toString(), "because", error.message);
                    return container.remove()
                        .then(function () {
                            track.errorForUsername(error, info.username, {info: info});
                            throw error;
                        }, function (error) {
                            track.errorForUsername(error, info.username, {info: info});
                        });
                });
        })
        .then(function () {
            return self.hostForProjectInfo(info);
        });
    this.pendingContainers.set(info.hash, containerPromise);
    return containerPromise;
};

ContainerManager.prototype.getOrCreate = function (info, githubAccessToken, githubProfile) {
    var self = this;
    var container = this.docker.getContainer(containerNameForProjectInfo(info));
    return container.inspect()
        .then(function (containerInfo) {
            if (!containerInfo.State.Running) {
                return container.remove()
                    .then(function () {
                        throw new Error("Container was stopped");
                    });
            }
            return container;
        })
        .catch(function (err) {
            if (!githubAccessToken || !githubProfile) {
                throw new Error("Cannot create project container without github credentials.");
            }
            return self._getRepoPrivacy(info, githubAccessToken)
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
                            return container;
                        });
                });
        })
        .then(function (container) {
            self.pendingContainers.delete(info.hash);
            return container;
        });
};

ContainerManager.prototype.buildOptionsForProjectInfo = function (info, githubAccessToken, githubProfile) {
    var projectConfig = {
        username: info.username,
        owner: info.owner,
        repo: info.repo,
        githubAccessToken: githubAccessToken,
        githubUser: githubProfile,
        subdomain: info.toPath()
    };
    var options = {
        name: containerNameForProjectInfo(info),
        Image: IMAGE_NAME,
        Memory: 1024 * 1024 * 1024,
        MemorySwap: 1024 * 1024 * 1024,
        Cmd: ['-c', JSON.stringify(projectConfig)],
        Env: [
            "NODE_ENV=" + (process.env.NODE_ENV || "development"),
            "FIREFLY_APP_URL=" + process.env.FIREFLY_APP_URL,
            "FIREFLY_PROJECT_URL=" + process.env.FIREFLY_PROJECT_URL
        ],
        PortBindings: {}
    };
    options.PortBindings[IMAGE_PORT_TCP] = [ {HostIp: "127.0.0.1"} ];
    return options;
};

/**
 * Starts a container if it is not already running.
 * @param {Dockerode.Container} container 
 */
ContainerManager.prototype.start = function (container) {
    return container.inspect()
        .then(function (containerInfo) {
            if (!containerInfo.State.Running) {
                return container.start();
            }
        }, function (err) {
            throw new Error("Unable to inspect container " + container.id + " while trying to start it. Error: " + err.message);
        })
        .then(function () {
            return container;
        });
};

/**
 * Connects a container to the projects network so that it can communicate with
 * the project daemon. Does nothing if the container is already on the network.
 * @param {Dockerode.Container} container
 */
ContainerManager.prototype.connectToProjectsNetwork = function (container) {
    var self = this;
    return container.inspect()
        .then(function (containerInfo) {
            var projectsNetwork;
            if (!containerInfo.NetworkSettings || !containerInfo.NetworkSettings.Networks[PROJECTS_NETWORK]) {
                projectsNetwork = self.docker.getNetwork(PROJECTS_NETWORK);
                log("Connecting container", container.id, "to projects network");
                return projectsNetwork.connect({ Container: container.id });
            }
        })
        .then(function () {
            return container;
        }, function (err) {
            throw new Error("Unable to connect container " + container.id + " to the projects network because the network does not exist. Error: " + err.message);
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
ContainerManager.prototype.waitForProjectServer = function (url, timeout, error) {
    var self = this;

    timeout = typeof timeout === "undefined" ? 5000 : timeout;
    if (timeout <= 0) {
        return Q.reject(new Error("Timeout while waiting for server at " + url + (error ? " because " + error.message : "")));
    }

    return self.request({
        host: url,
        port: IMAGE_PORT,
        method: "OPTIONS",
        path: "/"
    })
    .timeout(100)
    .catch(function (error) {
        log("Server at", url, "not available yet. Trying for", timeout - 100, "more ms");
        return Q.delay(100).then(function () {
            return self.waitForProjectServer(url, timeout - 100, error);
        });
    });
};

ContainerManager.prototype.delete = function (info) {
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

ContainerManager.prototype.deleteUserContainers = function (githubUsername) {
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
