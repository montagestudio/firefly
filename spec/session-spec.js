var packedSession = require("../packed-session");
var MockGithubApi = require("./mocks/github-api");

describe("packedSession", function () {
    var token, username, packed;

    beforeEach(function () {
        token = "0000000000000000";
        username = "jasmine";
        packed = "e2840fe3c165a547fe3bf4bb18d5dd12b2bd7bcb47cdcc35d54e6422dbc40473d43e307a";
    });

    it("packs session", function () {
        var session = {
            githubAccessToken: token,
            username: username
        };

        var sessionID = packedSession.pack(session);
        expect(typeof sessionID).toBe("string");
        expect(sessionID.length).toEqual(72);
    });

    it("unpacks session", function () {
        var session = {};

        packedSession._GithubApi = MockGithubApi;
        var validUser = packedSession.unpack(packed, session);
        expect(validUser).toBe(true);
        expect(session.username).toBe(username);
    });
});
