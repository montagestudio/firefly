var projectChain = require("../../project/project-chain");
var Q = require("q");
var CheckSession = require("../../check-session");
var Session = require("../../session");
var MockSession = require("../mocks/session");
var mockRequest = require("../mocks/request");
var GithubSessionStore = require("../../github-session-store");
var makeContainerIndex = require("../../project/make-container-index");

describe("project chain", function () {
    var token, username, packed, sessions, chain, request;
    beforeEach(function () {
        token = "0000000000000000";
        username = "jasmine";
        packed = "7975a23812090216eb5ded40c6c9031cc8c4ebc78291c128a0bcbf614a9e807aa6331aa0";

        sessions = {};

        chain = projectChain({
            sessions: MockSession(sessions),
            checkSession: CheckSession,
            containerManager: {setup: function () { return Q("1234"); }},
            containerIndex: makeContainerIndex()
        }).end();

        request = function (req) {
            return chain(mockRequest(req));
        };
    });

    describe("OPTIONS", function () {
        it("does not return any content", function (done) {
            request({
                method: "OPTIONS",
                url: "http://127.0.0.1:2440/index.html"
            })
            .then(function (response) {
                expect(response.body.join("")).toEqual("");
            })
            .done(done, done);
        });
    });

    describe("GET session", function () {
        beforeEach(function () {
            var store = new GithubSessionStore();
            store.sessions = sessions;

            chain = projectChain({
                sessions: Session("session", "x", null, store),
                checkSession: CheckSession,
                containerManager: {setup: function () { return Q("1234"); }},
                containerIndex: makeContainerIndex()
            }).end();
        });

        it("echos session cookie", function (done) {
            request({
                method: "GET",
                url: "http://127.0.0.1:2440/session?id=" + packed,
                headers: {
                    referer: "http://local-firefly.declarativ.net:2440",
                }
            })
            .then(function (response) {
                expect(response.status).toEqual(307);
                var setCookie = response.headers["set-cookie"][1];
                expect(setCookie).toContain(packed);
            }).then(done, done);
        });

        it("returns 400 bad request when the sessionId is invalid", function (done) {
            request({
                method: "GET",
                url: "http://127.0.0.1:2440/session?id=xxx",
                headers: {
                    referer: "http://local-firefly.declarativ.net:2440",
                }
            })
            .then(function (response) {
                expect(response.status).toEqual(400);
            }).then(done, done);
        });

        // FIXME: disabled until we work out how to transfer the session when
        // there is no referrer because of a log in through Github.
        xit("returns 403 when the referer is invalid", function (done) {
            request({
                method: "GET",
                url: "http://127.0.0.1:2440/session?id=xxx",
                headers: {
                }
            })
            .then(function (response) {
                expect(response.status).toEqual(403);
            }).then(done, done);
        });
    });
});
