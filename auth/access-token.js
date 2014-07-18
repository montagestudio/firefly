var HttpApps = require("q-io/http-apps");
var GithubApi = require("../inject/adaptor/client/core/github-api");
var querystring = require("querystring");

module.exports = function ($) {
    $("").app(function (request) {
        return request.body.read()
        .then(function (body) {
            var post = querystring.parse(body.toString("utf8"));

            console.log("post", post);
            request.session.githubAccessToken = post.token;

            console.log("githubApi");
            var githubApi = new GithubApi(request.session.githubAccessToken);
            console.log("getUser");
            return githubApi.getUser().then(function (user) {
                console.log("user", user);
                request.session.githubUser = user;
                request.session.username = user.login.toLowerCase();

                return HttpApps.redirect(request, "/");
            });
        });
    });
};
