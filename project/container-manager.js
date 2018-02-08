var log = require("../logging").from(__filename);
var track = require("../track");
var request = require("q-io/http").request;
var Q = require("q");
var environment = require("../environment");
var PreviewDetails = require("./preview-details");
var GithubService = require("../services/repository/github").GithubService;

// TODO configure
var IMAGE_NAME = "firefly-project";
var IMAGE_PORT = "2441";
// Needed by the Docker configuration
var IMAGE_PORT_TCP = IMAGE_PORT + "/tcp";

module.exports = ContainerManager;
function ContainerManager(docker, containers, subdomainDetailsMap, _request) {
    this.docker = docker;
    this.containers = containers;
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

    var info = self.containers.get(details);
    if (!info && (!githubAccessToken || !githubUser)) {
        return Q(false);
    }

    return self.getOrCreate(details, githubAccessToken, githubUser)
    .then(function (info) {
        return self.start(info);
    })
    .then(function (info) {
        return self.waitForServer(info);
    })
    .catch(function (error) {
        log("Removing container for", details.toString(), "because", error.message);

        self.delete(details)
        .catch(function (error) {
            track.errorForUsername(error, details.username, {details: details});
        });

        track.errorForUsername(error, details.username, {details: details});

        throw error;
    });
};

/**
 * Get the port of a given container. If the port is unknown, `undefined`
 * is returned
 * @param  {string} user
 * @param  {string} owner
 * @param  {string} repo
 * @return {string}       The port of the container, or `undefined`
 */
ContainerManager.prototype.getPort = function (details) {
    var info = this.containers.get(details);
    return info && info.port;
};

ContainerManager.prototype.delete = function (details) {
    var self = this;

    var info = self.containers.get(details);
    var container = new self.docker.Container(self.docker.modem, info.id);

    self.containers.delete(details);

    return container.stop()
    .then(function () {
        return container.remove();
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
    var info = self.containers.get(details);
    if (!info) {
        var created = this._getRepoPrivacy(details, githubAccessToken)
            .then(function (isPrivate) {
                if (isPrivate) {
                    details.setPrivate(true);
                }

                log("Creating container for", details.toString(), "...");
                track.messageForUsername("create container", details.username, {details: details});

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
                    name: generateContainerName(details),
                    Image: IMAGE_NAME,
                    Memory: 256 * 1024 * 1024,
                    MemorySwap: 256 * 1024 * 1024,
                    Cmd: ['-c', JSON.stringify(config)],
                    Env: [
                        "NODE_ENV=" + (process.env.NODE_ENV || "development"),
                        "FIREFLY_APP_URL=" + environment.app.href,
                        "FIREFLY_PROJECT_URL=" + environment.project.href,
                        "FIREFLY_PROJECT_SERVER_COUNT=" + environment.projectServers
                    ],
                    PortBindings: {}
                };
                // only bind to the local IP
                options.PortBindings[IMAGE_PORT_TCP] = [{HostIp: "127.0.0.1"}];

                return self.docker.createContainer(options)
                    .then(function (container) {
                        log("Created container", container.id, "for", details.toString());
                        info = {id: container.id};
                        self.containers.set(details, info);
                        return info;
                    });
            });

        self.containers.set(details, {created: created});

        return created;
    } else if (info.created && info.created.then) {
        return info.created;
    } else {
        return Q(info);
    }
};

/**
 * Starts a container if it's not already running and returns the exposed port
 * @param  {Object} info        Information from the containers map.
 * @return {Promise.<string>}   A promise for the container's exposed port
 */
ContainerManager.prototype.start = function (info) {
    var self = this;

    var container = new self.docker.Container(self.docker.modem, info.id);

    return container.inspect()
    .then(function (containerInfo) {
        if (containerInfo.State.Running) {
            return containerInfo;
        } else if (info.started && info.started.then) {
            return info.started;
        } else {
            log("Starting container", container.id);
            var options = {};

            info.started = container.start(options)
            .then(function () {
                // This promise must be removed so that future connections
                // don't think we're still in the process of starting
                delete info.started;
                return container.inspect();
            });
            return info.started;
        }
    })
    .then(getExposedPort)
    .then(function (port) {
        // store the port in memory so that it can be gotten synchronously
        info.port = port;
        return port;
    });
};

/**
 * Waits for a server to be available on the given port. Retries every
 * 100ms until timeout passes.
 * @param  {string} port        The port
 * @param  {number} [timeout]   The number of milliseconds to keep trying for
 * @param  {Error} [error]      An previous error that caused the timeout
 * @return {Promise.<string>}   A promise for the port resolved when the
 * server is available.
 */
ContainerManager.prototype.waitForServer = function (port, timeout, error) {
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
            return self.waitForServer(port, timeout - 100, error);
        });
    })
    .thenResolve(port);
};

function getExposedPort(containerInfo) {
    if (containerInfo && containerInfo.NetworkSettings && containerInfo.NetworkSettings.Ports) {
        return containerInfo.NetworkSettings.Ports[IMAGE_PORT_TCP][0].HostPort;
    } else {
        throw new Error("Cannot get exposed port, containerInfo keys: " + Object.keys(containerInfo.State).join(", "));
    }
}

var REPLACE_RE = /[^a-zA-Z0-9\-]/g;
function generateContainerName(details) {
    // Remove all characters that don't match the RE at the bottom of
    // http://docs.docker.io/en/latest/reference/api/docker_remote_api_v1.10/#create-a-container
    // (excluding "_", because we use that ourselves)
    var username = details.username.replace(REPLACE_RE, "");
    var owner = details.owner.replace(REPLACE_RE, "");
    var repo = details.repo.replace(REPLACE_RE, "");
    // avoid collisions
    var random = Date.now() + "" + Math.floor(Math.random()*10000);

    return username + "_" + owner + "_" + repo + "_" + random;
}
