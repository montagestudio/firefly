var packedSession = require("../packed-session");
var MockGithubApi = require("../mocks/github-api");

describe("packedSession", function () {
    var token, username, packed;

    beforeEach(function () {
        token = "0000000000000000";
        username = "jasmine";
        packed = "e2840fe3c165a547fe3bf4bb18d5dd12b2bd7bcb47cdcc35d54e6422dbc40473d43e307a";
    });

    it("packs session", function (done) {
        var session = {
            githubAccessToken: token,
            username: username
        };

        return packedSession.pack(session).then(function (sessionID) {
            expect(typeof sessionID).toBe("string");
            expect(sessionID.length).toEqual(72);
        }).then(done, done);
    });

    it("unpacks session", function (done) {
        var session = {};

        packedSession._GithubApi = MockGithubApi;
        return packedSession.unpack(packed, session).then(function (validUser) {
            expect(validUser).toBe(true);
            expect(session.username).toBe(username);
        }).then(done, done);
    });
});
