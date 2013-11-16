var Q = require("q");

module.exports = Git;

function Git(fs, accessToken) {
    this._fs = fs;
    this._accessToken = accessToken;
}

Git.prototype.clone = function(cloneUrl, path) {
    return Q.resolve("done");
};

Git.prototype.isCloned = function(repoPath) {
    var dotGitPath = this._fs.join(repoPath, ".git");

    return this._fs.isDirectory(dotGitPath);
};
