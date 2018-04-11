var log = require("./common/logging").from(__filename);
var track = require("./common/track");
var request = require("q-io/http").request;
var Q = require("q");
var ProjectInfo = require("./project-info");
var GithubService = require("./github-service").GithubService;
var fs = require("fs");
var path = require("path");
var yaml = require("js-yaml");
var exec = require("./common/exec");

var IMAGE_PORT = 2441;

var stackNameForProjectInfo = function (projectInfo) {
    return "firefly-project_" + projectInfo.username + "_" + projectInfo.owner + "_" + projectInfo.repo;
};

module.exports = UserStackManager;
function UserStackManager(docker, _request) {
    this.docker = docker;
    this.GithubService = GithubService;
    // Only used for testing
    this.request = _request || request;

    this.basicStackYml = yaml.safeLoad(fs.readFileSync(path.join(__dirname, "user-stacks/basic-stack.yml")));
}

UserStackManager.prototype.has = function (info) {
    return this.docker.listStacks()
        .then(function (stacks) {
            return !!stacks.filter(function (stack) {
                return stack.id === stackNameForProjectInfo(info);
            }).length;
        });
};

UserStackManager.prototype.stacksForUser = function (githubUser) {
    return this.docker.listStacks()
        .then(function (stacks) {
            return stacks.filter(function (stack) {
                return stack.id.indexOf("firefly_project_" + githubUser.login) === 0;
            });
        });
};

UserStackManager.prototype.setup = function (info, githubAccessToken, githubUser) {
    var self = this;

    if (!(info instanceof ProjectInfo)) {
        throw new Error("Given info was not an instance of ProjectInfo");
    }

    return this.docker.listStacks()
        .then(function (stacks) {
            var targetStack = stacks.filter(function (stack) {
                return stack.id === stackNameForProjectInfo(info);
            })[0];
            if (targetStack) {
                return targetStack;
            } else if (githubAccessToken || githubUser) {
                return self.deploy(info, githubAccessToken, githubUser);
            } else {
                throw new Error("Stack does not exist and no github credentials given to create it.");
            }
        })
        .then(function (stack) {
            return self.waitForProjectServer(self.projectUrl(info))
                .catch(function (error) {
                    log("Removing stack for", info.toString(), "because", error.message);
                    return stack.remove()
                        .then(function () {
                            track.errorForUsername(error, info.username, {info: info});
                            throw error;
                        }, function (error) {
                            track.errorForUsername(error, info.username, {info: info});
                        });
                });
        });
};

UserStackManager.prototype.deploy = function (info, githubAccessToken, githubUser) {
    var self = this;
    return this._getRepoPrivacy(info, githubAccessToken)
        .then(function (isPrivate) {
            if (isPrivate) {
                info.setPrivate(true);
            }

            log("Deploying stack for", info.toString(), "...");
            track.messageForUsername("deploy stack", info.username, {info: info});

            var stackFile = Object.assign({}, self.basicStackYml);
            var stackFilePath = path.join(__dirname, info.serviceName + "-stack.yml");
            var projectConfig = {
                username: info.username,
                owner: info.owner,
                repo: info.repo,
                githubAccessToken: githubAccessToken,
                githubUser: githubUser,
                subdomain: info.toPath()
            };
            stackFile.services.project.command = "-c '" + JSON.stringify(projectConfig) + "'";
            if (process.env.NODE_ENV === "development") {
                stackFile.services.project.volumes = [
                    process.env.PROJECT_ROOT + "/project/:/srv/project/",
                    "/srv/project/node_modules/",
                    process.env.PROJECT_ROOT + "/project/common/:/srv/project/common/",
                    "/srv/project/common/node_modules"
                ];
                stackFile.services.project.deploy.placement.constraints = [];
            }
            fs.writeFileSync(stackFilePath, yaml.safeDump(stackFile));

            var pullPromise;
            if (process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test") {
                pullPromise = Promise.resolve();
            } else {
                pullPromise = exec("docker-compose", ["-f", stackFilePath, "pull"]);
            }

            return pullPromise
                .then(function () {
                    return self.docker.deployStack(stackNameForProjectInfo(info), stackFilePath);
                })
                .then(function () {
                    fs.unlinkSync(stackFilePath);
                })
                .catch(function (err) {
                    fs.unlinkSync(stackFilePath);
                    throw err;
                });
        })
        .then(function () {
            log("Deployed stack for", info.toString());
            return null;
        });
};

UserStackManager.prototype.projectUrl = function (info) {
    return stackNameForProjectInfo(info) + "_project:" + IMAGE_PORT;
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
UserStackManager.prototype.waitForProjectServer = function (url, timeout, error) {
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
            return self.waitForProjectServer(url, timeout - 100, error);
        });
    })
    .thenResolve(url);
};

UserStackManager.prototype.removeStack = function (info) {
    var stack = this.docker.getStack(stackNameForProjectInfo(info));
    return stack.remove();
};

UserStackManager.prototype.removeUserStacks = function (githubUser) {
    return this.stacksForUser(githubUser)
        .then(function (stacks) {
            return Promise.all(stacks.map(function (stack) {
                return stack.remove();
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
