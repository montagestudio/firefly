var packedSession = require("../packed-session");
var MockGithubApi = require("./mocks/github-api");

describe("packedSession", function () {
    var token, username, packed;

    beforeEach(function () {
        token = "0000000000000000";
        username = "jasmine";
        packed = "f413f5aa777eea9584bfae04e11f166d60d95b6d8a7d4268e894dc614c47383c93cb606e";
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
