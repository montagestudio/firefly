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

Git.prototype.init = function(path) {
    return exec("git", ["init", path], "/");
};

Git.prototype.push = function(path, branch) {
    var args = ["push", "origin"];
    if (typeof branch === "string") {
        args.push(branch);
    }
    // The remote has already been set with the accessToken in Git#clone
    return exec("git", args, path);
};

// FIXME to avoid writing the accessToken to disk in .git/config do
// mkdir foo
// cd foo
// git init
// git pull https://<token>@github.com/username/bar.git
Git.prototype.clone = function(cloneUrl, path) {
    if (!/^https:\/\//.test(cloneUrl)) {
        return Q.reject(new Error("Clone url must be https://, not " + cloneUrl));
    }
    var parsed = URL.parse(cloneUrl);
    parsed.auth = this._accessToken + ":" + "x-oauth-basic";
    cloneUrl = URL.format(parsed);
    return exec("git", ["clone", cloneUrl, path], "/");
};

Git.prototype.isCloned = function(path) {
    var dotGitPath = fs.join(path, ".git");

    return fs.isDirectory(dotGitPath);
};
