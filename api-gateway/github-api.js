const axios = require('axios');

const API_URL = "https://api.github.com/";

/**
 * GitHub API v3
 */
class GithubApi {
    constructor(accessToken) {
        this._accessToken = accessToken;
        this.axios = axios.create({
            baseURL: API_URL,
            headers: {
                'Authorization': `token ${accessToken}`
            }
        });
    }

    /**
     * Users
     */

    // http://developer.github.com/v3/users/#get-the-authenticated-user
    getUser() {
        return this._request({
            method: "GET",
            url: "/user"
        });
    }

    /**
     * Git Data
     */

    // http://developer.github.com/v3/git/blobs/#get-a-blob
    getBlob(username, repository, sha, param) {
        return this._request({
            method: "GET",
            url: "/repos/" + username + "/" + repository + "/git/blobs/" + sha,
            param
        });
    }

    // http://developer.github.com/v3/git/blobs/#create-a-blob
    createBlob(username, repository, content, encoding) {
        return this._request({
            method: "POST",
            url: "/repos/" + username + "/" + repository + "/git/blobs",
            data: {
                content: content,
                encoding: encoding
            }
        });
    }

    // http://developer.github.com/v3/git/commits/#get-a-commit
    getCommit(username, repository, sha) {
        return this._request({
            method: "GET",
            url: "/repos/" + username + "/" + repository + "/git/commits/" + sha
        });
    }

    // http://developer.github.com/v3/git/trees/#get-a-tree
    getTree(username, repository, sha, recursive) {
        return this._request({
            method: "GET",
            url: "/repos/" + username + "/" + repository + "/git/trees/" + sha + (recursive ? "?recursive=1" : "")
        });
    }

    /**
     * Repositories
     */

    // http://developer.github.com/v3/repos/#list-your-repositories
    listRepositories(options) {
        return this._request({
            method: "GET",
            url: "/user/repos",
            query: options
        });
    }

    listOwnedRepositories(options) {
        options.affiliation = 'owner';
        return this._request({
            method: "GET",
            url: "/user/repos",
            query: options
        });
    }

    listContributingRepositories(options) {
        options.affiliation = 'collaborator';
        return this._request({
            method: "GET",
            url: "/user/repos",
            query: options
        });
    }

    // http://developer.github.com/v3/repos/#list-user-repositories
    listUserRepositories(username, options = {}) {
        return this._request({
            method: "GET",
            url: "/users/" + username + "/repos",
            query: options
        });
    }

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
     * Create a new repository for the authenticated user. Requires OAuth user.
     *
     * @param {string} repositoryName The name of the repository.
     * @param {CreateRepositoryOptions=} options
     *
     * http://developer.github.com/v3/repos/#create
     */
    createUserRepository(repositoryName, options = {}) {
        options.name = repositoryName;
        // sanity check on repositoryName
        if (/^[A-Za-z0-9_].+$/.test(repositoryName) !== true) {
            throw new Error("Invalid project name");
        }
        return this._request({
            method: "POST",
            url: "/user/repos",
            data: options
        });
    }

    /**
     * Create a new repository for the given organization. Requires OAuth user.
     *
     * @param {string} organizationName The name of the organization.
     * @param {string} repositoryName The name of the repository.
     * @param {CreateRepositoryOptions=} options
     *
     * http://developer.github.com/v3/repos/#create
     */
    createOrganizationRepository(organizationName, repositoryName, options = {}) {
        options.name = repositoryName;
        // sanity check on repo name
        if (/^[A-Za-z0-9_].+$/.test(repositoryName) !== true) {
            throw new Error("Invalid project name");
        }
        return this._request({
            method: "POST",
            url: "/orgs/" + organizationName + "/repos",
            data: options
        });
    }

    /**
     * fork a repository into an organization. OAuth users must supply
     * repo scope.
     *
     * @param {string} owner The owner of the repository to fork from.
     * @param {string} repo The name of the repository to fork.
     * @param {string} organization The name of the organization were to fork the repository to (optional).
     *
     * http://developer.github.com/v3/repos/forks/#create-a-fork
     */
    forkRepositoryInOrganization(owner, repo, organization) {
        const params = {
            method: "POST",
            url: "/repos/" + owner + "/" + repo + "/forks"
        };
        if (typeof organization === "string" && organization.length > 0) {
            params.data = {
                organization: organization
            };
        }
        return this._request(params);
    }

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
    createRepositoryInOrganization(name, organization, options = {}) {
        options.name = name;
        return this._request({
            method: "POST",
            url: "/orgs/" + organization + "/repos",
            data: options
        });
    }

    // https://developer.github.com/v3/repos/contents/#get-contents
    getContents(owner, name, path, param) {
        return this._request({
            method: 'GET',
            url: ('/repos/' + owner + '/' + name + '/contents/' + path).replace('//', '/'),
            param: param
        });
    }

    // http://developer.github.com/v3/repos/#get
    getRepository(username, repository) {
        return this._request({
            method: "GET",
            url: "/repos/" + username + "/" + repository
        });
    }

    // http://developer.github.com/v3/repos/#list-branches
    listBranches(username, repository) {
        return this._request({
            method: "GET",
            url: "/repos/" + username + "/" + repository + "/branches"
        });
    }

    // http://developer.github.com/v3/repos/#get-branch
    getBranch(username, repository, branch) {
        return this._request({
            method: "GET",
            url: "/repos/" + username + "/" + repository + "/branches/" + branch
        });
    }

    // https://developer.github.com/v3/activity/events/#list-repository-events
    getRepositoryEvents(username, repository, lastETag = 0) {
        return this._request({
            method: "GET",
            url: "/repos/" + username + "/" + repository + "/events",
            headers: {"If-None-Match": lastETag},
            responseHeaders: ["etag", "x-poll-interval"]
        });
    }

    /**
     * Gists
     */
    // http://developer.github.com/v3/gists/#create-a-gist
    createGist(description, files, public) {
        return this._request({
            method: "POST",
            url: "/gists",
            data: {
                description: description,
                public: this._accessToken ? !!public : true,
                files: files
            }
        });
    }

    _createQueryString(query) {
        return Object.keys(query)
            .map((name) => `${encodeURIComponent(name)}=${encodeURIComponent(query[name])}`)
            .join("&");
    }

    /**
     * Not part of Github API but they are helper functions
     */

    /**
     * An empty repository doesn't have branches.
     */
    isRepositoryEmpty(username, repository) {
        return this.listBranches(username, repository)
        .then((branches) => branches.length === 0);
    }

    repositoryExists(username, repository) {
        return this.getRepository(username, repository)
            .then((repo) => !!repo)
            .catch((err) => {
                if ("Not Found" === err.message) {
                    return false;
                } else {
                    throw err;
                }
            });
    }

    checkError(method, username, thisp) {
        return () => {
            const args = Array.prototype.slice.call(arguments);
            return method.apply(thisp, args).catch((error) => {
                console.log("Git Error", error.stack);
                return this.checkCredentials(username).then((success) => {
                    if (success) {
                        // Nothing wrong with github, let returns the original error
                        throw error;
                    } else {
                        throw new Error("Unauthorized access");
                    }
                }, function() {
                    throw new Error("Network error");
                });
            });
        };
    }

    checkCredentials(username) {
        return this.getUser().then((user) => user.login === username)
        .catch((error) => {
            if (error.message.indexOf("credential") !== -1) {
                // return false rather than an error for credential issue
                return false;
            }
            throw error;
        });
    }

    getInfo(username, repository) {
        return this.getRepository(username, repository)
        .then(function(repository) {
            return {
                //jshint -W106
                gitUrl: repository.clone_url,
                gitBranch: repository.default_branch
                //jshint +W106
            };
        });
    }

    listUserOrganizations() {
        return this._request({
            method: 'GET',
            url: '/user/orgs'
        });
    }

    listOrganizationRepositories(organizationName, options) {
        return this._request({
            method: 'GET',
            url: '/orgs/' + organizationName + '/repos',
            query: options
        });
    }

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
     * @property {array=} responseHeaders The list of headers to return with response.
     */

    /**
     * param {RequestOptions} request
     */
    _request(request) {
        const param = request.param ? "." + request.param : "";
        let queryString = "";

        if (request.query) {
            queryString = "?" + this._createQueryString(request.query);
        }

        const headers = {
            'Accept': `application/vnd.github.v3${param}+json`
        };
        if (request.headers) {
            Object.assign(request.headers, headers);
        }

        if (request.data) {
            headers['Content-Type'] = 'application/x-www-form-urlencoded';
        }
        return this.axios({
            method: request.method,
            url: `${request.url}${queryString}`,
            data: request.data
        })
        .then((response) => {
            if (response.headers && response.headers.length && request.headers && request.headers.length) {
                return response;
            } else {
                return response.data;
            }
        }, (error) => {
            const action = "Cannot " + request.method + " " + JSON.stringify(this.API_URL + request.url + queryString);
            // Try and give a friendly error from Github
            if (error.response && error.response.data) {
                const { errors, message } = error.response.data;
                if (errors && errors[0] && errors[0].message) {
                    error = new Error(action + " because " + errors[0].message);
                    error.shortMessage = errors[0].message;
                } else if (message && message.length) {
                    error = new Error(action + " because " + message);
                    error.shortMessage = message;
                }
            } else {
                error = new Error(action);
            }
            throw error;
        });
    }
}
module.exports = GithubApi;
