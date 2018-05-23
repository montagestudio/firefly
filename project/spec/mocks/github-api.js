var Q = require("q");

module.exports = GithubApi;

function GithubApi(options) {
    this._options = options || {};
}

function getRepositoryUrl(type, owner, repo) {
    var url = "";
    
    if (type === "html") {
        url = "https://github.com/{owner}/{repo}";
    } else if (type === "clone") {
        url = "https://github.com/{owner}/{repo}.git";
    } else if (type === "git") {
        url = "git://github.com/{owner}/{repo}.git";
    } else if (type === "ssh") {
        url = "git@github.com:{owner}/{repo}.git";
    }
    
    return url.replace("{owner}", owner)
              .replace("{repo}", repo);
}

GithubApi.prototype.getRepository = function(owner, repo) {
    return Q.resolve({
        owner: {
            login: owner
        },
        name: repo,
        //jshint -W106
        clone_url: getRepositoryUrl("clone", owner, repo),
        default_branch: this._options.defaultBranch || "master"
        //jshint +W106
    });
};

GithubApi.prototype.isRepositoryEmpty = function() {
    var options = this._options;
    
    return Q.resolve(
        "isRepositoryEmpty" in options ? options.isRepositoryEmpty : false
    );
};

GithubApi.prototype.getUser = function() {
    return Q.resolve({
        login: "Jasmine"
    });
};

GithubApi.prototype.getInfo = function(owner, repo) {
    return Q.resolve({
        gitUrl: getRepositoryUrl("clone", owner, repo),
        gitBranch: this._options.defaultBranch || "master"
    });
};

GithubApi.prototype.checkError = function (method, username, thisp) {
    return function wrapped() {
        var args = Array.prototype.slice.call(arguments);
        return method.apply(thisp, args);
    };
};

GithubApi.prototype.getRepositoryEvents = function () {
    return Q.resolve();
};
