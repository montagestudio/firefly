var env = require("./environment");
var Q = require("q");
var GithubApi = require("./inject/adaptor/client/core/github-api");
var cryptoService = require("./crypto-service")();

exports = module.exports = CheckSession;

function CheckSession(key) {
    return function(next) {
        return function(request, response) {
            var user = request.session.githubUser;

            if (user) {
                return next(request, response);
            } else {
                // Restore the session if the session id is a valid github token
                var done = Q();
                var _validUser = false;
                var sessionID = request.cookies[key];
                var githubLoginInfo;

                if (typeof sessionID === "string" && sessionID.length >= 128) {
                    var decryptedSessionID = cryptoService.decryptData(sessionID);
                    githubLoginInfo = typeof decryptedSessionID === "string" && decryptedSessionID.match(/^([0-9a-f]+)\/(.+)/);
                }

                if (githubLoginInfo && githubLoginInfo.length === 3) {
                    var githubApi = new GithubApi(githubLoginInfo[1]);

                    done = githubApi.getUser().then(function(user) {
                        var username = user.login.toLowerCase();

                        if (githubLoginInfo[2] === username) {
                            request.session.sessionId = sessionID;
                            request.session.githubUser = user;
                            request.session.username = user.login.toLowerCase();
                            request.session.githubAccessToken = githubLoginInfo[1];

                            _validUser = true;
                        }
                    });
                }

                return done.then(function() {
                    if (_validUser) {
                        return next(request, response);
                    } else {
                        return {
                            status: 302,
                            headers: {
                                "Location": env.getAppUrl()
                            }
                        };
                    }
                });
            }
        };
    };
}
