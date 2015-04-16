var Q = require("q");
var GithubApi = require("github");

exports.GithubService = GithubService = function(accessToken) {
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
    return Q.denodeify(this._githubApi.repos.get)({
        user: owner,
        repo: repo
    });
};
