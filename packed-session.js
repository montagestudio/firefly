var log = require("logging").from(__filename);
var track = require("./track");
var crypto = require("./crypto")();
var GithubApi = require("./inject/adaptor/client/core/github-api");

var routeProject = require("./route-project");

var packedSession =  {
    _GithubApi: GithubApi
};
module.exports = packedSession;


packedSession.pack = function(session) {
    if (!session.githubAccessToken || !session.username) {
        return "";
    }
    var podNumber = (session.podNumber ? session.podNumber : routeProject.podForUsername(session.username));
    return crypto.encryptData(session.githubAccessToken + "/" + session.username + "/" + podNumber);
};


packedSession.unpack = function(sessionID, session) {
    var sessionInfo;

    if (typeof sessionID === "string" && sessionID.length >= 40) {
        var decryptedSessionID = crypto.decryptData(sessionID);
        sessionInfo = typeof decryptedSessionID === "string" && decryptedSessionID.match(/^([0-9a-f]+)\/([^/]+)\/([^/]+)/);

        if (sessionInfo && sessionInfo.length === 4) {
            var githubAccessToken = sessionInfo[1];
            var username = sessionInfo[2];
            var podNumber = sessionInfo[3];

            session.sessionId = sessionID;
            session.username = username;
            session.githubAccessToken = githubAccessToken;
            session.podNumber = (podNumber ? podNumber : routeProject.podForUsername(username));

            var github = new this._GithubApi(githubAccessToken);
            session.githubUser = github.getUser()
            .catch(function (error) {
                log("*Invalid session token for*", username);
                track.errorForUsername(error, session.username);
                throw error;
            });

            return true;
        } else {
            log("*Invalid encrypted sessionID*", decryptedSessionID);
            return false;
        }
    } else {
        if (sessionID !== undefined) {
            log("*Invalid sessionID*", sessionID);
        }
        return false;
    }
};
