var log = require("./common/logging").from(__filename);
var track = require("./common/track");
var joey = require("joey");
var uuid = require("uuid");
var querystring = require("querystring");

var Http = require("q-io/http");
var HttpApps = require("q-io/http-apps");
var parseCookies = require("./common/parse-cookies");
var LogStackTraces = require("./common/log-stack-traces");
var GithubApi = require("./common/inject/adaptor/client/core/github-api");
var jwt = require("./common/jwt");

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

/**
 * For some reason request.url always starts with http when it should be https.
 * This causes problems with redirection (especially in local development)
 */
var fixProtocol = function (next) {
    return function (request) {
        request.url = request.url.replace(/^http:/, "https:");
        return next(request);
    };
}

module.exports = server;
function server(options) {
    options = options || {};

    //jshint -W116
    if (!options.sessions) throw new Error("options.sessions required");
    var sessions = options.sessions;
    if (!options.proxyMiddleware) throw new Error("options.proxyMiddleware required");
    var proxyMiddleware = options.proxyMiddleware;
    //jshint +W116

    return joey
    .error()
    // Put here to avoid printing logs when HAProxy pings the server for
    // a health check
    .route(function () {
        this.OPTIONS("").content("");
    })
    .use(fixProtocol)
    .log(log, function (message) { return message; })
    .use(track.joeyErrors)
    .use(LogStackTraces(log))
    .parseQuery()
    .tap(parseCookies)
    .use(sessions)
    .route(function (route, GET) {
        GET("auth").app(jwt(function (request) {
            return HttpApps.responseForStatus(request, 200);
        }));

        route("auth/...").route(function (route) {
            route("github/...").route(function (route) {
                route("").app(function (request) {
                    return requestAuth(request, ["user:email", "public_repo", "read:org"]);
                });

                route("private").app(function (request) {
                    return requestAuth(request, ["user:email", "repo", "read:org"]);
                });

                route("callback").app(function (request) {
                    if (request.query.state !== request.session.oauthState) {
                        // It's a forgery!
                        return HttpApps.redirect(request, "/");
                    }
                    // Don't need this any more
                    delete request.session.oauthState;

                    if (request.query.error) {
                        return HttpApps.ok("Github error. Please try again", "text/plain", 400);
                    }

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
                            "code": request.query.code
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

                            track.message("user logged in", request);
                            //jshint -W106
                            var githubAccessToken = data.access_token;
                            //jshint +W106
                            return new GithubApi(githubAccessToken).getUser()
                                .then(function (githubUser) {
                                    return jwt.sign({
                                        githubUser: githubUser,
                                        githubAccessToken: githubAccessToken
                                    });
                                })
                                .then(function (token) {
                                    return HttpApps.redirect(request, "/#token=" + token);
                                });
                        });
                    });
                });

                route("token")
                    .use(jwt)
                    .contentApp(function (request) {
                        return request.githubAccessToken;
                    });
            });
        });

        route("").app(proxyMiddleware("http://static/app/index.html"));

        route("favicon.ico").terminate(proxyMiddleware("http://static/app/assets/img/favicon.ico"));

        // We don't have anything to show directly on the user page at the
        // moment, so just redirect them to the root.
        // At the time of writing, if we don't redirect then the app tries to
        // load a project with an empty name "", which causes all kinds of
        // errors.
        route(":owner").redirect("/");
        route(":owner/").redirect("/");

        route(":owner/:repo").app(proxyMiddleware("http://static/app/index.html"));
        route(":owner/:repo/").app(proxyMiddleware("http://static/app/index.html"));
    })
    //////////////////////////////////////////////////////////////////////
    .route(function (route) {
    });
}
