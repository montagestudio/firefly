var log = require("logging").from(__filename);
var Q = require("q");
var fs = require("q-io/fs");
var URL = require("url");
var exec = require("./exec");

// This module uses Github's OAuth over Basic Authentication as described at
// https://github.com/blog/1270-easier-builds-and-deployments-using-git-over-https-and-oauth

module.exports = Git;
function Git(fs, accessToken) {
    this._accessToken = accessToken;
}

Git.prototype.init = function(repoPath) {
    log("init " + repoPath);
    return exec("git", ["init", repoPath], "/");
};

Git.prototype.config = function(repoPath, option, value) {
    log("config " + option + " " + value);
    return exec("git", ["config", "--file", ".git/config", option, value], repoPath);
};

Git.prototype.addRemote = function (repoPath, url) {
    log("remote add origin " + url);
    return exec("git", ["remote", "add", "origin", url], repoPath);
};

Git.prototype.add = function(repoPath, paths) {
    log("add " + paths);
    var args = ["add"].concat(paths);
    return exec("git", args, repoPath);
};

Git.prototype.commit = function (repoPath, message) {
    var args = ["commit", "-m", message];
    log("commit ", args);
    return exec("git", args, repoPath);
};

Git.prototype.push = function(repoPath, repositoryUrl, branch) {
    if (!/^https:\/\//.test(repositoryUrl)) {
        return Q.reject(new Error("Push url must be https://, not " + repositoryUrl));
    }
    log("push " + repositoryUrl + (branch ? " " + branch : ""));
    repositoryUrl = this._addAccessToken(repositoryUrl);
    var args = ["push", repositoryUrl];
    if (typeof branch === "string") {
        args.push(branch);
    }
    // The remote has already been set with the accessToken in Git#clone
    return exec("git", args, repoPath);
};

// FIXME to avoid writing the accessToken to disk in .git/config do
// mkdir foo
// cd foo
// git init
// git pull https://<token>@github.com/username/bar.git
Git.prototype.clone = function(cloneUrl, repoPath) {
    if (!/^https:\/\//.test(cloneUrl)) {
        return Q.reject(new Error("Clone url must be https://, not " + cloneUrl));
    }
    return exec("git", ["clone", cloneUrl, repoPath], "/");
};

Git.prototype.isCloned = function(repoPath) {
    var dotGitPath = fs.join(repoPath, ".git");

    return fs.isDirectory(dotGitPath);
};

Git.prototype._addAccessToken = function (url) {
    var parsed = URL.parse(url);
    parsed.auth = this._accessToken + ":" + "x-oauth-basic";
    return URL.format(parsed);
};
