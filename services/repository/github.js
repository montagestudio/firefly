var Promise = require("bluebird");
var GithubApi = require("github");

var GithubService = exports.GithubService = function(accessToken) {
    this._githubApi = new GithubApi({
        version: '3.0.0',
        headers: {
            'user-agent': 'MontageStudio.com'
        }
    });
    this._githubApi.authenticate({
        type: 'oauth',
        token: accessToken
    });
};

GithubService.prototype.getRepo = function(owner, repo) {
    return Promise.promisify(this._githubApi.repos.get)({
        user: owner,
        repo: repo
    });
};

GithubService.prototype.getOrganizations = function(username) {
    return Promise.promisify(this._githubApi.orgs.getFromUser)({
        user: username
    });
};
