var Q = require("q");
var exec = require("./exec");

module.exports = Git;
function Git(fs, accessToken) {
    this._fs = fs;
    this._accessToken = accessToken;
}

Git.prototype.clone = function(cloneUrl, path) {
    if (!/^https:\/\//.test(cloneUrl)) {
        return Q.reject(new Error("Clone url must be https://, not " + cloneUrl));
    }
    return exec("git", ["clone", cloneUrl, path], "/");
};

Git.prototype.isCloned = function(repoPath) {
    var dotGitPath = this._fs.join(repoPath, ".git");

    return this._fs.isDirectory(dotGitPath);
};
