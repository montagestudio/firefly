var projectChain = require("../chain");
var Q = require("q");
var CheckSession = require("../common/check-session");
var Session = require("../common/session");
var MockSession = require("../common/spec/mocks/session");
var mockRequest = require("../common/spec/mocks/request");
var GithubSessionStore = require("../common/github-session-store");
var makeContainerIndex = require("../make-container-index");

describe("project chain", function () {
    var token, username, packed, sessions, containerManager, containerIndex, chain, request;
    beforeEach(function () {
        token = "0000000000000000";
        username = "jasmine";
        packed = "7975a23812090216eb5ded40c6c9031cc8c4ebc78291c128a0bcbf614a9e807aa6331aa0";

        sessions = {};
        containerManager = {
            setup: function () { return Q("1234"); },
            delete: jasmine.createSpy().andReturn(Q())
        };
        containerIndex = makeContainerIndex();

        chain = projectChain({
            sessions: MockSession(sessions),
            checkSession: CheckSession,
            containerManager: containerManager,
            containerIndex: containerIndex
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
                containerIndex: containerIndex
            }).end();
        });

        it("echos session cookie", function (done) {
            request({
                method: "GET",
                url: "http://127.0.0.1:2440/session?id=" + packed,
                headers: {
                    referer: "http://local.montage.studio:2440",
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
                    referer: "http://local.montage.studio:2440",
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

    describe("DELETE api/workspaces", function () {
        it("calls containerManager.delete with the container's details", function (done) {
            // fake session
            sessions.abc = {
                username: username,
                githubUser: Q({})
            };

            var details = {username: username, owner: username, repo: "repo"};
            containerIndex.set(details, null);

            request({
                method: "DELETE",
                url: "http://api.localhost:2440/workspaces",
                headers: {
                    cookie: "session=abc"
                }
            })
            .then(function (response) {
                expect(response.status).toEqual(200);
                expect(response.body.join("")).toEqual('{"deleted":true}');
                expect(containerManager.delete).toHaveBeenCalledWith(details);
            }).then(done, done);
        });
    });
});
