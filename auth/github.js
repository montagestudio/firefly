var log = require("../logging").from(__filename);
var track = require("../track");
var querystring = require("querystring");

var uuid = require("uuid");
var Http = require("q-io/http");
var HttpApps = require("q-io/http-apps");

var GithubApi = require("../inject/adaptor/client/core/github-api");

var accounts = require("../accounts");

var CLIENT_ID = process.env.GITHUB_CLIENT_ID;
var CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;

var requestAuth = function (request, scopes) {
    var oauthState = uuid.v4();
    request.session.oauthState = oauthState;

    return HttpApps.redirect(request, "https://github.com/login/oauth/authorize?" +
        querystring.stringify({
            "client_id": CLIENT_ID,
            "scope": scopes.join(","),
            "state": oauthState
        }
    ));
};

module.exports = function ($) {
    $("").app(function (request) {
        return requestAuth(request, ["user:email", "public_repo", "read:org"]);
    });

    $("private").app(function (request) {
        return requestAuth(request, ["user:email", "repo", "read:org"]);
    });

    $("callback").app(function (request) {
        if (request.query.state !== request.session.oauthState) {
            // It's a forgery!
            return HttpApps.redirect(request, "/");
        }
        // Don't need this any more
        delete request.session.oauthState;

        if (request.query.error) {
            return HttpApps.ok("Github error. Please try again", "text/plain", 400);
        }

        // console.log("code is", code);

        var code = request.query.code;

        return Http.request({
            url: "https://github.com/login/oauth/access_token",
            method: "POST",
            headers: {
                "Accept": "application/json",
                "Content-Type": "application/x-www-form-urlencoded"
            },
            body: [querystring.stringify({
                "client_id": CLIENT_ID,
                "client_secret": CLIENT_SECRET,
                "code": code
            })]
        }).then(function (response) {
            return response.body.read().then(function (body) {
                if (response.status !== 200) {
                    throw new Error("Github answered request for access token with status " + response.status + ": " + body);
                } else if (response.headers["content-type"] !== "application/json; charset=utf-8") {
                    throw new Error("Github answered request for access token with an unexpected content type " + response.headers["content-type"] + ": " + body);
                }
                var data;
                try {
                    data = JSON.parse(body.toString("utf-8"));
                } catch (e) {
                    throw new Error("Github answered request for access token with ill-formatted JSON.");
                }

                //jshint -W106
                request.session.githubAccessToken = data.access_token;
                //jshint +W106

                var githubApi = new GithubApi(request.session.githubAccessToken);
                var githubUser = githubApi.getUser();
                request.session.githubUser = githubUser;

                return githubUser.then(function (user) {
                    request.session.username = user.login.toLowerCase();
                    request.session.recurlyAccount = accounts.getOrCreate(request.session.username, request.session.githubUser);

                    track.message("user logged in", request);

                    return HttpApps.redirect(request, "/auth/next");
                });
            });
        });
    });

    $("token").contentApp(function (request) {
        if(!request.session.githubAccessToken) {
            log("No session");
        } else {
            return request.session.githubAccessToken;
        }
    });

};
