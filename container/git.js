var log = require("../logging").from(__filename);
var track = require("../track");
var Promise = require("bluebird");
var URL = require("url");
var exec = require("./exec");
var Semaphore = require("./semaphore").Semaphore;

// This module uses Github's OAuth over Basic Authentication as described at
// https://github.com/blog/1270-easier-builds-and-deployments-using-git-over-https-and-oauth

module.exports = Git;
/**
 * Semaphore to use when building chained git operations. Prevents interleaving
 * git operations that might affect two different chained operations.
 */
module.exports.semaphore = new Semaphore();

function Git(_fs, accessToken, acceptOnlyHttpsRemote) {
    this._accessToken = accessToken;
    this._acceptOnlyHttpsRemote = (acceptOnlyHttpsRemote !== false);
    this._fs = _fs;
}

Git.prototype.init = function(repoPath) {
    log("init " + repoPath);
    return exec("git", ["init", repoPath], "/")
    .catch(function (error) {
        track.error(error);
        throw new Error("git init failed.");
    });
};

Git.prototype.config = function(repoPath, option, value) {
    log("config " + option + " " + value);
    return exec("git", ["config", "--file", ".git/config", option, value], repoPath)
    .catch(function (error) {
        track.error(error);
        throw new Error("git config failed.");
    });
};

Git.prototype.addRemote = function (repoPath, url) {
    log("remote add origin " + url);
    return exec("git", ["remote", "add", "origin", url], repoPath)
    .catch(function (error) {
        track.error(error);
        throw new Error("git add origin failed.");
    });
};

Git.prototype.fetch = function(repoPath, remoteRepoNames, options) {
    log("fetch " + remoteRepoNames);
    var args = ["fetch"];
    if (options !== undefined) {
        args = args.concat(options);
    }
    args.push(remoteRepoNames || "--all");
    return exec("git", args, repoPath)
    .catch(function (error) {
        track.error(error);
        throw new Error("git fetch failed.");
    });
};

Git.prototype.branch = function(repoPath, option) {
    log("branches " + option);
    if (!Array.isArray(option)) {
        option = [option];
    }
    return exec("git", ["branch"].concat(option), repoPath, true)
    .catch(function (error) {
        track.error(error);
        throw new Error("git branch failed.");
    });
};

Git.prototype.currentBranch = function(repoPath) {
    log("head");
    return this.command(repoPath, "rev-parse", ["--abbrev-ref", "HEAD"], true)
    .then(function(result) {
        if (result && result.length > 1) {
            return result.slice(0, -1);
        } else {
            return result;
        }
    });
};

Git.prototype.status = function(repoPath, options) {
    log("status " + options);
    return this.command(repoPath, "status", options, true);
};

Git.prototype.add = function(repoPath, paths) {
    log("add", paths);
    var args = ["add"].concat(paths);
    return exec("git", args, repoPath)
    .catch(function (error) {
        track.error(error);
        throw new Error("git add failed.");
    });
};

Git.prototype.rm = function(repoPath, paths) {
    log("rm", paths);
    var self = this;

    // We need to process each path one by one as we need to use the -r option when removing a directory
    return Promise.all(paths.map(function (path) {
        if ((path.slice(-1) === self._fs.SEPARATOR)) {
            return exec("git", ["rm", "-r", path], repoPath);
        } else {
            return exec("git", ["rm", path], repoPath);
        }
    }).map(function (promise) {
        return promise.reflect();
    }))
    .fail(function (error) {
        track.error(error);
        throw new Error("git rm failed.");
    });
};

Git.prototype.checkout = function (repoPath, branch, create, merge) {
    log("checkout " + branch);
    var args = ["checkout", branch];

    if (merge === true) {
        args.splice(1, 0, ["-m"]);
    }
    if (create === true) {
        args.splice(1, 0, ["-b"]);
    }

    return exec("git", args, repoPath)
    .catch(function (error) {
        track.error(error);
        throw new Error("git checkout failed.");
    });
};

Git.prototype.merge = function (repoPath, branch, squash) {
    var args = (squash === true) ? ["merge", "-q", "--squash", branch] : ["merge", "-q", branch];
    log("merge ", branch, squash === true ? "squash" : "");
    return exec("git", args, repoPath)
    .catch(function (error) {
        track.error(error);
        throw new Error("git merge failed.");
    });
};

Git.prototype.commit = function (repoPath, message, amend) {
    var args = amend === true ? ["commit", "--amend", "-m", message] : ["commit", "-m", message];
    log("commit ", args);
    return exec("git", args, repoPath)
    .catch(function (error) {
        track.error(error);
        throw new Error("git commit failed.");
    });
};

Git.prototype.push = function(repoPath, repositoryUrl, branch, options) {
    if (this._acceptOnlyHttpsRemote && !/^https:\/\//.test(repositoryUrl)) {
        return Promise.reject(new Error("Push url must be https://, not " + repositoryUrl));
    }
    log("push " + repositoryUrl + (branch ? " " + branch : ""));
    repositoryUrl = this._addAccessToken(repositoryUrl);
    var args = ["push", repositoryUrl];
    if (options !== undefined) {
        args = args.concat(options);
    }
    if (typeof branch === "string") {
        args.push(branch);
    }
    // The remote has already been set with the accessToken in Git#clone
    return exec("git", args, repoPath)
    .catch(function (error) {
        track.error(error);
        throw new Error("git push failed.");
    });
};

// FIXME to avoid writing the accessToken to disk in .git/config do
// mkdir foo
// cd foo
// git init
// git pull https://<token>@github.com/username/bar.git
Git.prototype.clone = function(cloneUrl, repoPath) {
    if (this._acceptOnlyHttpsRemote && !/^https:\/\//.test(cloneUrl)) {
        return Promise.reject(new Error("Clone url must be https://, not " + cloneUrl));
    }
    return exec("git", ["clone", this._addAccessToken(cloneUrl), repoPath], "/")
    .catch(function (error) {
        track.error(error);
        throw new Error("git clone failed.");
    });
};

Git.prototype.isCloned = function(repoPath) {
    var dotGitPath = this._fs.join(repoPath, ".git");

    return this._fs.isDirectory(dotGitPath);
};

Git.prototype._addAccessToken = function (url) {
    var parsed = URL.parse(url);
    parsed.auth = this._accessToken + ":" + "x-oauth-basic";
    return URL.format(parsed);
};

Git.prototype.command = function(repoPath, command, options, shouldReturnOutput) {
    var args = [command];
    if (options !== undefined) {
        args = args.concat(options);
    }
    return exec("git", args, repoPath, shouldReturnOutput)
    .catch(function (error) {
        track.error(error);
        throw new Error("git " + command + " failed.");
    });
};
