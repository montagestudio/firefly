var log = require("logging").from(__filename);
var Q = require("q");
var cryptoService = require("./crypto-service")();
var GithubApi = require("./inject/adaptor/client/core/github-api");

var packedSession =  {
    _GithubApi: GithubApi
};
module.exports = packedSession;


packedSession.pack = function(session) {
    return Q(cryptoService.encryptData(session.githubAccessToken + "/" + session.username));
};


packedSession.unpack = function(sessionID, session) {
    var deferred = Q.defer();
    var githubLoginInfo;

    if (typeof sessionID === "string" && sessionID.length >= 40) {
        var decryptedSessionID = cryptoService.decryptData(sessionID);
        githubLoginInfo = typeof decryptedSessionID === "string" && decryptedSessionID.match(/^([0-9a-f]+)\/(.+)/);

        if (githubLoginInfo && githubLoginInfo.length === 3) {
            var githubAccessToken = githubLoginInfo[1];
            var githubUsername = githubLoginInfo[2];
            var github = new this._GithubApi(githubAccessToken);

            github.getUser().then(function(user) {
                var username = user.login.toLowerCase();

                if (githubUsername === username) {
                    session.sessionId = sessionID;
                    session.githubUser = user;
                    session.username = username;
                    session.githubAccessToken = githubAccessToken;
                    deferred.resolve(true);
                }
            }, function() {
                log("*Invalid session token or username*");
                deferred.resolve(false);
            }).done();
        } else {
            log("*Invalid encrypted sessionID*", decryptedSessionID);
            deferred.resolve(false);
        }
    } else {
        if (sessionID !== undefined) {
            log("*Invalid sessionID*", sessionID);
        }
        deferred.resolve(false);
    }

    return deferred.promise;
};
