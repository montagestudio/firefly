var packedSession = require("../packed-session");
var MockGithubApi = require("../mocks/github-api");

describe("packedSession", function () {
    var _token = "0000000000000000",
        _username = "jasmine",
        _sessionID;

    it("packs session", function (done) {
        var session = {
            githubAccessToken: _token,
            username: _username
        };

        return packedSession.pack(session).then(function(sessionID) {
            _sessionID = sessionID;
            expect(typeof _sessionID).toBe("string");
        }).then(done, done);
    });

    it("unpacks session", function (done) {
        var session = {};

        packedSession._GithubApi = MockGithubApi;
        return packedSession.unpack(_sessionID, session).then(function(validUser) {
            expect(validUser).toBe(true);
            expect(session.username).toBe(_username);
        }).then(done, done);
    });
});
