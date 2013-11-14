var Q = require("q");

module.exports = GithubApi;

/**
 * GitHub API v3
 */
function GithubApi(accessToken) {
    this._accessToken = accessToken;
}

GithubApi.prototype.API_URL = "https://api.github.com";

/**
 * Git Data
 */

// http://developer.github.com/v3/git/blobs/#get-a-blob
GithubApi.prototype.getBlob = function(username, repository, sha, param) {
    return this._request({
        method: "GET",
        url: "/repos/" + username + "/" + repository + "/git/blobs/" + sha,
        param: param
    });
};

// http://developer.github.com/v3/git/commits/#get-a-commit
GithubApi.prototype.getCommit = function(username, repository, sha) {
    return this._request({
        method: "GET",
        url: "/repos/" + username + "/" + repository + "/git/commits/" + sha
    });
};

// http://developer.github.com/v3/git/trees/#get-a-tree
GithubApi.prototype.getTree = function(username, repository, sha, recursive) {
    return this._request({
        method: "GET",
        url: "/repos/" + username + "/" + repository + "/git/trees/" + sha + (recursive ? "?recursive=1" : "")
    });
};

/**
 * Repositories
 */

// http://developer.github.com/v3/repos/#get
GithubApi.prototype.getRepository = function(username, repository) {
    return this._request({
        method: "GET",
        url: "/repos/" + username + "/" + repository
    });
};

// http://developer.github.com/v3/repos/#get-branch
GithubApi.prototype.getBranch = function(username, repository, branch) {
    return this._request({
        method: "GET",
        url: "/repos/" + username + "/" + repository + "/branches/" + branch
    });
};

// http://developer.github.com/v3/repos/#get-branch
GithubApi.prototype.createGist = function(description, files) {
    return this._request({
        method: "POST",
        url: "/gists",
        data: {
            description: description,
            public: this._access_token ? false : true,
            files: files
        },
        headers: {
            "Content-Type": "application/json; charset=utf-8"
        }
    });
};

GithubApi.prototype._request = function(request) {
    var xhr = new XMLHttpRequest(),
        deferred = Q.defer(),
        param = request.param ? "." + request.param : "";

    xhr.open(request.method, this.API_URL + request.url);
    xhr.addEventListener("load", function() {
        var message;

        if (xhr.status >= 200 && xhr.status < 300) {
            if (xhr.responseText) {
                if (request.param === "raw") {
                    message = xhr.responseText;
                } else {
                    message = JSON.parse(xhr.responseText);
                }
            }
            deferred.resolve(message);
        } else {
            deferred.reject(xhr);
        }
    }, false);
    xhr.addEventListener("error", function() {
        deferred.reject(xhr);
    }, false);

    xhr.setRequestHeader("Accept", "application/vnd.github.v3" + param + "+json");
    if (this._access_token) {
        xhr.setRequestHeader("Authorization", "token " + this._access_token);
    }
    if (request.data) {
        xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
    }
    if (request.headers) {
        Object.keys(request.headers).forEach(function(header) {
            xhr.setRequestHeader(header, request.headers[header]);
        });
    }

    if (request.data) {
        xhr.send(JSON.stringify(request.data));
    } else {
        xhr.send();
    }

    return deferred.promise;
};