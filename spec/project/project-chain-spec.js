var projectChain = require("../../project/project-chain");
var Q = require("q");
var CheckSession = require("../../check-session");
var Session = require("../../session");
var MockSession = require("../mocks/session");
var mockRequest = require("../mocks/request");
var GithubSessionStore = require("../../github-session-store");

describe("project chain", function () {
    var token, username, packed, sessions, chain, request;
    beforeEach(function () {
        token = "0000000000000000";
        username = "jasmine";
        packed = "e2840fe3c165a547fe3bf4bb18d5dd12b2bd7bcb47cdcc35d54e6422dbc40473d43e307a";

        sessions = {};

        chain = projectChain({
            sessions: MockSession(sessions),
            checkSession: CheckSession,
            setupProjectContainer: function () { return Q("1234"); }
        }).end();

        request = function (req) {
            return chain(mockRequest(req));
        };
    });

    describe("POST session", function () {
        beforeEach(function () {
            var store = new GithubSessionStore();
            store.sessions = sessions;

            chain = projectChain({
                sessions: Session("session", "x", null, store),
                checkSession: CheckSession,
                setupProjectContainer: function () { return Q("1234"); }
            }).end();
        });

        it("echos cookie", function (done) {
            request({
                method: "POST",
                url: "http://127.0.0.1:2440/session",
                headers: {
                    origin: "http://local-firefly.declarativ.net:2440",
                },
                body: ['{"sessionId":"' + packed + '"}']
            })
            .then(function (response) {
                var setCookie = response.headers["set-cookie"][0];
                expect(setCookie).toContain(packed);
                expect(response.status).toEqual(200);
            }).then(done, done);
        });

        it("returns 400 bad request when the sessionId is invalid", function (done) {
            request({
                method: "POST",
                url: "http://127.0.0.1:2440/session",
                headers: {
                    origin: "http://local-firefly.declarativ.net:2440",
                },
                body: ['{"sessionId":"xxx"}']
            })
            .then(function (response) {
                expect(response.status).toEqual(400);
            }).then(done, done);
        });
    });
});
