var log = require("logging").from(__filename);
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

    return function (user, owner, repo, githubAccessToken, githubUser) {
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

            var config = {
                username: user,
                owner: owner,
                repo: repo,
                githubAccessToken: githubAccessToken,
                githubUser: githubUser
            };

            var created = docker.createContainer({
                Image: IMAGE_NAME,
                Cmd: ['-c', JSON.stringify(config)],
                Env: [
                    "NODE_ENV=" + (environment.production ? "production" : ""),
                    "FIREFLY_APP_URL=" + environment.app.href,
                    "FIREFLY_PROJECT_URL=" + environment.project.href
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
            if (!containerInfo.State.Running) {
                log("Starting container", container.id);
                var options = {};
                options.PortBindings = {};
                // only bind to the local IP
                options.PortBindings[IMAGE_PORT_TCP] = [{HostIp: "127.0.0.1"}];

                return container.start(options)
                .then(function () {
                    return container.inspect();
                });
            } else {
                return containerInfo;
            }
        })
        .then(getExposedPort);
    }

    /**
     * Waits for a server to be available on the given port. Retries every
     * 100ms until timeout passes.
     * @param  {string} port        The port
     * @param  {number} timeout     The number of milliseconds to keep trying for
     * @return {Promise.<string>}   A promise for the port resolved when the
     * server is available.
     */
    function waitForServer(port, timeout) {
        timeout = typeof timeout === "undefined" ? 2000 : timeout;
        if (timeout <= 0) {
            return Q.reject(new Error("Timeout while waiting for server on port " + port));
        }

        return request({
            host: "127.0.0.1",
            port: port,
            method: "OPTIONS",
            path: "/check"
        })
        .catch(function (error) {
            if (error.code === "ECONNRESET") {
                log("Server at", port, "not available yet. Trying for", timeout - 100, "more ms");
                return Q.delay(100).then(function () {
                    return waitForServer(port, timeout - 100);
                });
            } else {
                log("*Error connecting to " + port + "*", error);
                throw error;
            }
        })
        .thenResolve(port);
    }

    function getExposedPort(containerInfo) {
        return containerInfo.HostConfig.PortBindings[IMAGE_PORT_TCP][0].HostPort;
    }
}
