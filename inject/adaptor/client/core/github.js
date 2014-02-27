/* global XMLHttpRequest */
var Promise = require("montage/core/promise").Promise;
var GithubFs = require("./fs-github");
var GithubApi = require("./github-api");

exports.githubFs = function(username, repository) {
    var deferred = Promise.defer();

    AuthToken().then(function (token) {
        deferred.resolve(new GithubFs(username, repository, token));
    }).fail(deferred.reject).done();

    return deferred.promise;
};

var githubApiPromise;
exports.githubApi = function() {
    if (!githubApiPromise) {
        var deferred = Promise.defer();
        githubApiPromise = deferred.promise;
        AuthToken().then(function (token) {
            deferred.resolve(new GithubApi(token));
        }).fail(deferred.reject).done();
    }

    return githubApiPromise;
};

function AuthToken() {
    var pendingTimeout;
    var timeout = 5000;
    var response = Promise.defer();
    var request = new XMLHttpRequest();
    request.open("GET", "/auth/github/token", true);
    request.onreadystatechange = function () {
        if (request.readyState === 4) {
            if (request.status === 200) {
                if(pendingTimeout) {
                    clearTimeout(pendingTimeout);
                }
                response.resolve(request.responseText);
            } else {
                response.reject("HTTP " + request.status + " for /auth/token");
            }
        }
    };
    pendingTimeout = setTimeout(response.reject, timeout - 50);
    request.send();
    return response.promise.timeout(timeout);
}