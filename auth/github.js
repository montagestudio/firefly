var log = require("logging").from(__filename);
var Q = require("q");
var https = require("https");
var querystring = require("querystring");

var uuid = require("uuid");
var redirect = require("q-io/http-apps/redirect").redirect;

var CLIENT_ID = "e3a42c8d5e2631ed7707";
var CLIENT_SECRET = "a4c0a8eb95388febf206493eddd26e679b6407ba";
var CALLBACK = "http://127.0.0.1:2440/auth/github/callback";

var OAUTH_STATE = uuid.v4();

module.exports = function ($) {
    $("").redirect("https://github.com/login/oauth/authorize?" +
        querystring.stringify({
            "client_id": CLIENT_ID,
            "redirect_uri": CALLBACK,
            "scope": ["user:email", "repo"].join(","),
            "state": OAUTH_STATE
        })
    );

    $("callback").app(function (request) {
        if (request.query.state !== OAUTH_STATE) {
            // It's a forgery!
            return redirect(request, "/");
        }

        if (request.query.error) {
            return {
                status: 400,
                headers: {
                    "content-type": "text/plain"
                },
                body: ["Github error. Please try again."]
            };
        }

        var done = Q.defer();

        var code = request.query.code;
        // console.log("code is", code);
        var data = querystring.stringify({
            "client_id": CLIENT_ID,
            "client_secret": CLIENT_SECRET,
            "code": code
        });

        var req = https.request({
            hostname: "github.com",
            path: "/login/oauth/access_token",
            method: "POST",
            headers: {
                "Accept": "application/json",
                "Content-Type": "application/x-www-form-urlencoded"
            }
        }, function (res) {
            var body = "";
            res.setEncoding('utf8');
            res.on('data', function(chunk) {
                body += chunk;
            });
            res.on("end", function () {
                var data;
                try {
                    data = JSON.parse(body);
                } catch (e) {
                    log("error", "parsing Github access token response", body);
                    return;
                }
                //jshint -W106
                request.session.githubAccessToken = data.access_token;
                //jshint +W106
                done.resolve(redirect(request, "/projects"));
            });
        });
        req.on('error', function(e) {
            log("error", "POSTing to get github access token", e);
        });
        req.end(data, "utf-8");

        return done.promise;
    });


    $("token").contentApp(function (request) {
        if(!request.session.githubAccessToken) {
            log("No session");
        } else {
            return request.session.githubAccessToken;
        }
    });

};
