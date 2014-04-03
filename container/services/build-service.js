var Q = require("q");
var GithubApi = require("../../inject/adaptor/client/core/github-api");
var Git = require("../git");
var mop = require("../mop").mop;

module.exports = BuildService;

var GITHUB_PAGES_DOMAIN = "github.io";
var GITHUB_PAGES_BRANCH = "gh-pages";
var GITHUB_PAGES_MESSAGE = "Publish build";
var DEFAULT_GIT_EMAIL = "noreply";
var semaphore = Git.semaphore;

function BuildService(session, fs, environment, pathname, fsPath) {
    // Returned service
    var service = {};
    var _owner = session.owner;
    var _repo = session.repo;
    var _git = new Git(fs, session.githubAccessToken, true);
    var _githubApi = new GithubApi(session.githubAccessToken);
    var _githubUser = session.githubUser;

    service.optimize = function (options) {
        var config = {};

        if (options.status) {
            config.out = {};
            config.out.status = createThrottlingStatusFunction(options.status);
        }
        if ("minify" in options) {
            config.minify = options.minify;
        }

        return mop.optimize(fsPath, config);
    };

    service.archive = function() {
        return mop.archive();
    };

    service.publishToGithubPages = function() {
        return mop.getBuildLocation()
        .then(function(buildLocation) {
            return pushDirectoryToBranch(buildLocation, GITHUB_PAGES_BRANCH, GITHUB_PAGES_MESSAGE, true);
        });
    };

    var pushDirectoryToBranch = _githubApi.checkError(semaphore.exclusive(function(directory, branch, message, force) {
        // TODO: should actually checkout gh-pages first if they exist and
        // remove everything before adding. This will make the publish much
        // slower and the end result is kind of the same. Living with this for
        // now.

        return _git.init(directory)
        .then(function() {
            // Configure user info
            var name = _githubUser.name || _githubUser.login;
            var email = _githubUser.email || DEFAULT_GIT_EMAIL;

            return _git.config(directory, "user.name", name)
            .then(function() {
                return _git.config(directory, "user.email", email);
            })
            .then(function() {
                // Only push when specified where
                return _git.config(directory, "push.default", "nothing");
            })
            .then(function() {
                // Allow large pushes (500MB)
                return _git.config(directory, "http.postBuffer", "524288000");
            });
        })
        .then(function() {
            return _git.add(directory, ["."]);
        })
        .then(function() {
            return _git.commit(directory, message);
        })
        .then(function() {
            return getRepositoryUrl();
        })
        .then(function(repoUrl) {
            return _git.push(directory, repoUrl, "HEAD:"+branch, force ? ["-f"] : void 0);
        })
        .then(function() {
            return "http://" + _owner + "." + GITHUB_PAGES_DOMAIN + "/" + _repo;
        });
    }), _owner);

    var repositoryUrlPromise;
    var getRepositoryUrl = function() {
        var deferred;

        if (!repositoryUrlPromise) {
            deferred = Q.defer();
            repositoryUrlPromise = deferred.promise;
            _githubApi.getInfo(_owner, _repo).then(function(info) {
                return _git._addAccessToken(info.gitUrl);
            }).
            then(deferred.resolve, deferred.reject).done();
        }

        return repositoryUrlPromise;
    };

    return service;
}

function createThrottlingStatusFunction(statusFunction) {
    var previousMessage;

    return function(status) {
        var message;

        if (status) {
            // TODO: maybe mop can do this in the future? returning keys for the
            // status instead of an english sentence.
            if (status.indexOf("Reading") >= 0) {
                message = "Reading files...";
                message = "reading";
            } else {
                message = status.toLowerCase();
            }

            if (message !== previousMessage) {
                statusFunction(message);
                previousMessage = message;
            }
        }
    };
}