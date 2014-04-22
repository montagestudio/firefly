var log = require("../logging").from(__filename);
var track = require("../track");
var request = require("q-io/http").request;
var Q = require("q");
var environment = require("../environment");

module.exports = SetupProjectContainer;
function SetupProjectContainer(docker, containers, _request) {
    // Only used for testing
    if (_request) {
        request = _request;
    }

    // TODO configure
    var IMAGE_NAME = "firefly_project";
    var IMAGE_PORT = "2441";
    // Needed by the Docker configuration
    var IMAGE_PORT_TCP = IMAGE_PORT + "/tcp";

    var setupProjectContainer = function (user, owner, repo, githubAccessToken, githubUser) {
        user = user.toLowerCase();
        owner = owner.toLowerCase();
        repo = repo.toLowerCase();

        var containerKey = {user: user, owner: owner, repo: repo};

        var info = containers.get(containerKey);
        if (!info && (!githubAccessToken || !githubUser)) {
            return Q(false);
        }

        return getOrCreateContainer(containerKey, user, owner, repo, githubAccessToken, githubUser)
        .then(startContainer)
        .then(waitForServer)
        .catch(function (error) {
            log("Removing container for", JSON.stringify(containerKey), "because", error.message);
            containers.delete(containerKey);

            track.errorForUsername(error, user, {containerKey: containerKey});

            throw error;
        });
    };

    // FIXME: Done for expediency. This file should be reorganised into a class
    // or something.
    setupProjectContainer.delete = function (user, owner, repo) {
        var containerKey = {user: user, owner: owner, repo: repo};
        var info = containers.get(containerKey);
        var container = new docker.Container(docker.modem, info.id);

        return container.stop()
        .then(function () {
            return container.remove();
        });
    };

    return setupProjectContainer;

    /**
     * Gets or creates an container for the given user/owner/repo combo
     * @param  {string} user  The currently logged in username
     * @param  {string} owner The owner of the repo
     * @param  {string} repo  The name of the repo
     * @return {Promise.<Object>} An object of information about the container
     */
    function getOrCreateContainer(containerKey, user, owner, repo, githubAccessToken, githubUser) {
        var info = containers.get(containerKey);

        if (!info) {
            log("Creating container for", user, owner, repo, "...");
            track.messageForUsername("create container", user, {containerKey: containerKey});

            var config = {
                username: user,
                owner: owner,
                repo: repo,
                githubAccessToken: githubAccessToken,
                githubUser: githubUser
            };

            var name = generateContainerName(user, owner, repo);

            var created = docker.createContainer({
                name: name,
                Image: IMAGE_NAME,
                Memory: 256 * 1024 * 1024,
                MemorySwap: 256 * 1024 * 1024,
                Cmd: ['-c', JSON.stringify(config)],
                Env: [
                    "NODE_ENV=" + (process.env.NODE_ENV || "development"),
                    "FIREFLY_APP_URL=" + environment.app.href,
                    "FIREFLY_PROJECT_URL=" + environment.project.href,
                    "FIREFLY_PROJECT_SERVER_COUNT=" + environment.projectServers
                ]
            })
            .then(function (container) {
                log("Created container", container.id, "for", user, owner, repo);
                info = {id: container.id};
                containers.set(containerKey, info);
                return info;
            });

            containers.set(containerKey, {created: created});

            return created;
        } else if (info.created && info.created.then) {
            return info.created;
        } else {
            return Q(info);
        }
    }

    /**
     * Starts a container if it's not already running and returns the exposed port
     * @param  {Object} info        Information from the containers map.
     * @return {Promise.<string>}   A promise for the container's exposed port
     */
    function startContainer(info) {
        var container = new docker.Container(docker.modem, info.id);

        return container.inspect()
        .then(function (containerInfo) {
            if (containerInfo.State.Running) {
                return containerInfo;
            } else if (info.started && info.started.then) {
                return info.started;
            } else {
                log("Starting container", container.id);
                var options = {};
                options.PortBindings = {};
                // only bind to the local IP
                options.PortBindings[IMAGE_PORT_TCP] = [{HostIp: "127.0.0.1"}];

                info.started = container.start(options)
                .then(function () {
                    return container.inspect();
                });
                return info.started;
            }
        })
        .then(getExposedPort);
    }

    /**
     * Waits for a server to be available on the given port. Retries every
     * 100ms until timeout passes.
     * @param  {string} port        The port
     * @param  {number} [timeout]   The number of milliseconds to keep trying for
     * @param  {Error} [error]      An previous error that caused the timeout
     * @return {Promise.<string>}   A promise for the port resolved when the
     * server is available.
     */
    function waitForServer(port, timeout, error) {
        timeout = typeof timeout === "undefined" ? 5000 : timeout;
        if (timeout <= 0) {
            return Q.reject(new Error("Timeout while waiting for server on port " + port + (error ? " because " + error.message : "")));
        }

        return request({
            host: "127.0.0.1",
            port: port,
            method: "OPTIONS",
            path: "/check"
        })
        .catch(function (error) {
            log("Server at", port, "not available yet. Trying for", timeout - 100, "more ms");
            return Q.delay(100).then(function () {
                return waitForServer(port, timeout - 100, error);
            });
        })
        .thenResolve(port);
    }

    function getExposedPort(containerInfo) {
        if (containerInfo && containerInfo.HostConfig && containerInfo.HostConfig.PortBindings) {
            return containerInfo.HostConfig.PortBindings[IMAGE_PORT_TCP][0].HostPort;
        } else {
            throw new Error("Cannot get exposed port, containerInfo keys: " + Object.keys(containerInfo.State).join(", "));
        }
    }
}

var REPLACE_RE = /[^a-zA-Z0-9\-]/g;
function generateContainerName(user, owner, repo) {
    // Remove all characters that don't match the RE at the bottom of
    // http://docs.docker.io/en/latest/reference/api/docker_remote_api_v1.10/#create-a-container
    // (excluding "_", because we use that ourselves)
    user = user.replace(REPLACE_RE, "");
    owner = owner.replace(REPLACE_RE, "");
    repo = repo.replace(REPLACE_RE, "");
    // avoid collisions
    var random = Date.now() + "" + Math.floor(Math.random()*10000);

    return user + "_" + owner + "_" + repo + "_" + random;
}
