/* global XMLHttpRequest */
var Q = require("q");

if (typeof window === "undefined") {
    //jshint -W020
    XMLHttpRequest = require/**/("xmlhttprequest").XMLHttpRequest;
    //jshint +W020
}

module.exports = GithubApi;

/**
 * GitHub API v3
 */
function GithubApi(accessToken) {
    this._accessToken = accessToken;
}

GithubApi.prototype.API_URL = "https://api.github.com";

/**
 * Users
 */

// http://developer.github.com/v3/users/#get-the-authenticated-user
GithubApi.prototype.getUser = function() {
    return this._request({
        method: "GET",
        url: "/user"
    });
};

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

// http://developer.github.com/v3/git/blobs/#create-a-blob
GithubApi.prototype.createBlob = function(username, repository, content, encoding) {
    return this._request({
        method: "POST",
        url: "/repos/" + username + "/" + repository + "/git/blobs",
        data: {
            content: content,
            encoding: encoding
        }
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
GithubApi.prototype.listRepositories = function(options) {
    return this._request({
        method: "GET",
        url: "/user/repos",
        query: options
    });
};

// http://developer.github.com/v3/repos/#list-user-repositories
GithubApi.prototype.listUserRepositories = function(username) {
    return this._request({
        method: "GET",
        url: "/users/" + username + "/repos"
    });
};

/**
 * @typedef CreateRepositoryOptions
 * @type {object}
 * @property {string=} description A short description of the repository
 * @property {string=} homepage A URL with more information about the repository
 * @property {boolean=false} private Either true to create a private repository, or
 *           false to create a public one. Creating private repositories
 *           requires a paid GitHub account.
 * @property {boolean=true} has_issues Either true to enable issues for this
 *           repository, false to disable them.
 * @property {boolean=true} has_wiki Either true to enable the wiki for this
 *           repository, false to disable it.
 * @property {boolean=true} has_downloads Either true to enable downloads for
 *           this repository, false to disable them.
 * @property {number} team_id The id of the team that will be granted access to
 *           this repository. This is only valid when creating a repo in an
 *           organization.
 * @property {boolean=false} auto_init Pass true to create an initial commit
 *           with empty README.
 * @property {string} gitignore_template Desired language or platform .gitignore
 *           template to apply. Use the name of the template without the
 *           extension. For example, “Haskell”. Ignored if the auto_init
 *           parameter is not provided.
 */

/**
 * Create a new repository for the authenticated user. OAuth users must supply
 * repo scope.
 *
 * @param {string} name The name of the repository.
 * @param {CreateRepositoryOptions=} options
 *
 * http://developer.github.com/v3/repos/#create
 */
GithubApi.prototype.createRepository = function(name, options) {
    options = options || {};
    options.name = name;
    return this._request({
        method: "POST",
        url: "/user/repos",
        data: options
    });
};

/**
 * Create a new repository in an organization. OAuth users must supply
 * repo scope.
 *
 * @param {string} name The name of the repository.
 * @param {string} organization The name of the organization.
 * @param {CreateRepositoryOptions} options
 *
 * http://developer.github.com/v3/repos/#create
 */
GithubApi.prototype.createRepositoryInOrganization = function(name, organization, options) {
    options = options || {};
    options.name = name;
    return this._request({
        method: "POST",
        url: "/orgs/" + organization + "/repos",
        data: options
    });
};

// http://developer.github.com/v3/repos/#get
GithubApi.prototype.getRepository = function(username, repository) {
    return this._request({
        method: "GET",
        url: "/repos/" + username + "/" + repository
    });
};

// http://developer.github.com/v3/repos/#list-branches
GithubApi.prototype.listBranches = function(username, repository) {
    return this._request({
        method: "GET",
        url: "/repos/" + username + "/" + repository + "/branches"
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
 * Not part of Github API but they are helper functions
 */

/**
 * An empty repository doesn't have branches.
 */
GithubApi.prototype.isRepositoryEmpty = function(username, repository) {
    return this.listBranches(username, repository)
    .then(function(branches) {
        return branches.length === 0;
    });
};

GithubApi.prototype.repositoryExists = function(username, repository) {
    return this.listUserRepositories(username)
    .then(function(repos) {
        for (var i = 0; i < repos.length; i++) {
            if (repos[i].name === repository) {
                return true;
            }
        }
        return false;
    });
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