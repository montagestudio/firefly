/* global XMLHttpRequest */
var Promise = require("montage/core/promise").Promise;
var GithubFs = require("./fs-github");
var GithubApi = require("./github-api");

var token;

exports.githubFs = function(username, repository) {
    return AuthToken().then(function (token) {
        return new GithubFs(username, repository, token);
    });
};

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
    var pendingTimeout;
    var timeout = 5000;

    return new Promise(function (resolve, reject) {
        if (!token) {
            var request = new XMLHttpRequest();
            request.open("GET", "/auth/github/token", true);
            request.onreadystatechange = function () {
                if (request.readyState === 4) {
                    if (request.status === 200) {
                        if(pendingTimeout) {
                            clearTimeout(pendingTimeout);
                        }
                        token = request.responseText;
                        resolve(request.responseText);
                    } else {
                        reject("HTTP " + request.status + " for /auth/token");
                    }
                }
            };
            pendingTimeout = setTimeout(reject, timeout - 50);
            request.send();
        } else {
            resolve(token);
        }
    }).timeout(timeout);
}
