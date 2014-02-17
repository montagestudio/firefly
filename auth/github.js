var log = require("logging").from(__filename);
var querystring = require("querystring");
var Env = require("../environment");

var uuid = require("uuid");
var Http = require("q-io/http");
var HttpApps = require("q-io/http-apps");

var GithubApi = require("../inject/adaptor/client/core/github-api");

var CLIENT_ID,CLIENT_SECRET;
if (Env.production) {
    CLIENT_ID = process.env.GITHUB_CLIENT_ID;
    CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;
} else {
    CLIENT_ID = "e3a42c8d5e2631ed7707";
    CLIENT_SECRET = "a4c0a8eb95388febf206493eddd26e679b6407ba";
}

var OAUTH_STATE = uuid.v4();

module.exports = function ($) {
    $("").redirect("https://github.com/login/oauth/authorize?" +
        querystring.stringify({
            "client_id": CLIENT_ID,
            "scope": ["user:email", "repo"].join(","),
            "state": OAUTH_STATE
        })
    );

    $("callback").app(function (request) {
        if (request.query.state !== OAUTH_STATE) {
            // It's a forgery!
            return HttpApps.redirect(request, "/");
        }

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

                    return HttpApps.redirect(request, "/projects");
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
