/* global XMLHttpRequest */
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

// http://developer.github.com/v3/repos/#list-your-repositories
GithubApi.prototype.listRepositories = function() {
    return this._request({
        method: "GET",
        url: "/user/repos"
    });
};

// http://developer.github.com/v3/repos/#list-user-repositories
GithubApi.prototype.listUserRepositories = function(username) {
    return this._request({
        method: "GET",
        url: "/users/" + username + "/repos"
    });
};

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

/**
 * Gists
 */
// http://developer.github.com/v3/gists/#create-a-gist
GithubApi.prototype.createGist = function(description, files, public) {
    return this._request({
        method: "POST",
        url: "/gists",
        data: {
            description: description,
            public: this._accessToken ? !!public : true,
            files: files
        }
    });
};

GithubApi.prototype._createQueryString = function(query) {
    return Object.keys(query).map(function(name) {
        return encodeURIComponent(name) + "=" + encodeURIComponent(query[name]);
    }).join("&");
};

/**
 * @typeof RequestOptions
 * @type {object}
 * @property {string} url The URL to request.
 * @property {string} method The method to use: "GET", "POST", "PATCH", etc.
 * @property {object=} data The data as a JSON structure to send with the
 *           request. Usually used with creating / modifying requests.
 * @property {object=} query A dictionary with the names and values to pass in
 *           the request as a query string.
 * @property {object=} headers A dictionary with the name of the headers and
 *           value to send in the request.
 * @property {string=""} param The github param modifier for media types:
 *           http://developer.github.com/v3/media/.
 */

/**
 * param {RequestOptions} request
 */
GithubApi.prototype._request = function(request) {
    var xhr = new XMLHttpRequest(),
        deferred = Q.defer(),
        param = request.param ? "." + request.param : "",
        queryString = "";

    if (request.query) {
        queryString = "?" + this._createQueryString(request.query);
    }

    xhr.open(request.method, this.API_URL + request.url + queryString);
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
    if (this._accessToken) {
        xhr.setRequestHeader("Authorization", "token " + this._accessToken);
    }
    if (request.headers) {
        Object.keys(request.headers).forEach(function(header) {
            xhr.setRequestHeader(header, request.headers[header]);
        });
    }

    if (request.data) {
        xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
        xhr.send(JSON.stringify(request.data));
    } else {
        xhr.send();
    }

    return deferred.promise;
};