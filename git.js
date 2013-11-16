var Q = require("q");
var fs = require("q-io/fs");
var exec = require("./exec");

module.exports = Git;
function Git(fs, accessToken) {
    this._accessToken = accessToken;
}

Git.prototype.init = function(path) {
    return exec("git", ["init", path], "/");
};

Git.prototype.clone = function(cloneUrl, path) {
    if (!/^https:\/\//.test(cloneUrl)) {
        return Q.reject(new Error("Clone url must be https://, not " + cloneUrl));
    }
    return exec("git", ["clone", cloneUrl, path], "/");
};

Git.prototype.isCloned = function(path) {
    var dotGitPath = fs.join(path, ".git");

    return fs.isDirectory(dotGitPath);
};
