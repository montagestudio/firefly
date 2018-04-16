var GithubApi = require("./github-api");
var application = require("montage/core/application").application;

var token;

var githubApiPromise;
exports.githubApi = function() {
    if (!githubApiPromise) {
        githubApiPromise = AuthToken().then(function (token) {
            return new GithubApi(token);
        });
    }

    return githubApiPromise;
};

function AuthToken() {
    if (token) {
        return Promise.resolve(token);
    }
    return application.delegate.request({
        subdomain: "auth",
        url: "/github/token"
    }).then(function (response) {
        token = response.body;
        return token;
    }).timeout(5000);
}
