var log = require("logging").from(__filename);
var Q = require("q");
var URL = require("url");
var exec = require("./exec");
var Semaphore = require("./semaphore").Semaphore;

// This module uses Github's OAuth over Basic Authentication as described at
// https://github.com/blog/1270-easier-builds-and-deployments-using-git-over-https-and-oauth

class Git {
    constructor(_fs, accessToken, acceptOnlyHttpsRemote) {
        this._accessToken = accessToken;
        this._acceptOnlyHttpsRemote = (acceptOnlyHttpsRemote !== false);
        this._fs = _fs;
    }

    async init(repoPath) {
        log("init " + repoPath);
        try {
            return await exec("git", ["init", repoPath], "/")
        } catch (error) {
            console.error(error);
            throw new Error("git init failed.");
        }
    }

    async config(repoPath, option, value) {
        log("config " + option + " " + value);
        try {
            return await exec("git", ["config", "--file", ".git/config", option, value], repoPath)
        } catch (error) {
            console.error(error);
            throw new Error("git config failed.");
        }
    }

    async addRemote(repoPath, url) {
        log("remote add origin " + url);
        try {
            return await exec("git", ["remote", "add", "origin", url], repoPath);
        } catch (error) {
            console.error(error);
            throw new Error("git add origin failed.");
        }
    }

    async fetch(repoPath, remoteRepoNames, options) {
        log("fetch " + remoteRepoNames);
        var args = ["fetch"];
        if (options !== undefined) {
            args = args.concat(options);
        }
        args.push(remoteRepoNames || "--all");
        try {
            return await exec("git", args, repoPath);
        } catch (error) {
            console.error(error);
            throw new Error("git fetch failed.");
        }
    }

    async branch(repoPath, option) {
        log("branches " + option);
        if (!Array.isArray(option)) {
            option = [option];
        }
        try {
            return await exec("git", ["branch"].concat(option), repoPath, true);
        } catch (error) {
            console.error(error);
            throw new Error("git branch failed.");
        }
    }

    async currentBranch(repoPath) {
        log("head");
        const result = await this.command(repoPath, "rev-parse", ["--abbrev-ref", "HEAD"], true);
        if (result && result.length > 1) {
            return result.slice(0, -1);
        } else {
            return result;
        }
    }

    async status(repoPath, options) {
        log("status " + options);
        return this.command(repoPath, "status", options, true);
    }

    async add(repoPath, paths) {
        log("add", paths);
        var args = ["add"].concat(paths);
        try {
            return await exec("git", args, repoPath);
        } catch (error) {
            console.error(error);
            throw new Error("git add failed.");
        }
    }

    async rm(repoPath, paths) {
        log("rm", paths);
        try {
            // We need to process each path one by one as we need to use the -r option when removing a directory
            return await Q.allSettled(paths.map((path) => {
                if ((path.slice(-1) === this._fs.SEPARATOR)) {
                    return exec("git", ["rm", "-r", path], repoPath);
                } else {
                    return exec("git", ["rm", path], repoPath);
                }
            }))
        } catch (error) {
            console.error(error);
            throw new Error("git rm failed.");
        }
    }

    async checkout(repoPath, branch, create, merge) {
        log("checkout " + branch);
        const args = ["checkout", branch];

        if (merge === true) {
            args.splice(1, 0, ["-m"]);
        }
        if (create === true) {
            args.splice(1, 0, ["-b"]);
        }

        try {
            return await exec("git", args, repoPath);
        } catch (error) {
            console.error(error);
            throw new Error("git checkout failed.");
        }
    }

    async merge(repoPath, branch, squash) {
        const args = (squash === true) ? ["merge", "-q", "--squash", branch] : ["merge", "-q", branch];
        log("merge ", branch, squash === true ? "squash" : "");
        try {
            return await exec("git", args, repoPath);
        } catch (error) {
            console.error(error);
            throw new Error("git merge failed.");
        }
    }

    async commit(repoPath, message, amend) {
        const args = amend === true ? ["commit", "--amend", "-m", message] : ["commit", "-m", message];
        log("commit ", args);
        try {
            return await exec("git", args, repoPath);
        } catch (error) {
            console.error(error);
            throw new Error("git commit failed.");
        }
    }

    async push(repoPath, repositoryUrl, branch, options) {
        if (this._acceptOnlyHttpsRemote && !/^https:\/\//.test(repositoryUrl)) {
            return Q.reject(new Error("Push url must be https://, not " + repositoryUrl));
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
        try {
            return await exec("git", args, repoPath);
        } catch (error) {
            console.error(error);
            throw new Error("git push failed.");
        }
    }

    // FIXME to avoid writing the accessToken to disk in .git/config do
    // mkdir foo
    // cd foo
    // git init
    // git pull https://<token>@github.com/username/bar.git
    async clone(cloneUrl, repoPath) {
        if (this._acceptOnlyHttpsRemote && !/^https:\/\//.test(cloneUrl)) {
            return Q.reject(new Error("Clone url must be https://, not " + cloneUrl));
        }
        try {
            return await exec("git", ["clone", this._addAccessToken(cloneUrl), repoPath], "/");
        } catch (error) {
            console.error(error);
            throw new Error("git clone failed.");
        }
    }

    async isCloned(repoPath) {
        const dotGitPath = this._fs.join(repoPath, ".git");
        return this._fs.isDirectory(dotGitPath);
    }

    _addAccessToken(url) {
        const parsed = URL.parse(url);
        parsed.auth = this._accessToken + ":" + "x-oauth-basic";
        return URL.format(parsed);
    }

    async command(repoPath, command, options, shouldReturnOutput) {
        var args = [command];
        if (options !== undefined) {
            args = args.concat(options);
        }
        try {
            return await exec("git", args, repoPath, shouldReturnOutput);
        } catch (error) {
            console.error(error);
            throw new Error("git " + command + " failed.");
        }
    }
}

module.exports = Git;

/**
 * Semaphore to use when building chained git operations. Prevents interleaving
 * git operations that might affect two different chained operations.
 */
module.exports.semaphore = new Semaphore();
