var log = require("logging").from(__filename);
var request = require("q-io/http").request;
var Q = require("q");
var ProjectWorkspace = require("./project-workspace");

module.exports = SetupProjectWorkspace;
function SetupProjectWorkspace(docker, containers) {
    // TODO configure
    var IMAGE_NAME = "firefly_project";
    var IMAGE_PORT = "2441";
    var IMAGE_PORT_TCP = IMAGE_PORT + "/tcp";

    return function (next) {
        return function (request, response) {
            var session = request.session;
            var user = session.username.toLowerCase();
            var owner = request.params.owner.toLowerCase();
            var repo = request.params.repo.toLowerCase();

            return getOrCreateContainer(user, owner, repo)
            .then(startContainer)
            .then(function (port) {
                // request.projectWorkspace = new ProjectWorkspace(session, port, owner, repo);
                return next(request, response);
            });
        };
    };

    /**
     * Gets or creates an container for the given user/owner/repo combo
     * @param  {string} user  The currently logged in username
     * @param  {string} owner The owner of the repo
     * @param  {string} repo  The name of the repo
     * @return {Promise.<Object>} An object of information about the container
     */
    function getOrCreateContainer(user, owner, repo) {
        var info = containers.get({user: user, owner: owner, repo: repo});

        if (!info) {
            log("Creating container for", user, owner, repo, "...");
            var created = docker.createContainer({
                Image: IMAGE_NAME
            })
            .then(function (container) {
                log("Created container", container.id, "for", user, owner, repo);
                info = {id: container.id};
                containers.set({user: user, owner: owner, repo: repo}, info);
                return info;
            });

            containers.set({user: user, owner: owner, repo: repo}, {created: created});

            return created;
        } else if (info.created && info.created.then) {
            return info.created;
        } else {
            log("Existing container for", user, owner, repo, "is", info.id);
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
                log("Already running", container.id);
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
            host: "localhost",
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
