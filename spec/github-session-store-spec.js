var GithubSessionStore = require("../github-session-store");

describe("GithubSessionStore", function () {
    var store;

    beforeEach(function () {
        store = new GithubSessionStore();
    });

    describe("get", function () {
        it("returns a cached session", function (done) {
            var id = "test";
            store.sessions[id] = {pass: true};
            return store.get(id)
            .then(function (session) {
                expect(session).toEqual({pass: true});
            })
            .done(done, done);
        });

        it("returns undefined for an invalid id", function (done) {
            var id = "test";
            return store.get(id)
            .then(function (session) {
                expect(session).toBeUndefined();
            })
            .done(done, done);
        });
    });

    describe("set", function () {
        it("changes the sessionId", function (done) {
            var session = {
                sessionId: "fail",
                githubAccessToken: "xxx",
                username: "test"
            };
            return store.set("old", session)
            .then(function () {
                expect(session.sessionId).not.toEqual("fail");
            })
            .done(done, done);
        });

        it("does not save empty sessions", function (done) {
            var session = {};
            return store.set("old", session)
            .then(function () {
                expect(Object.keys(store.sessions).length).toEqual(0);
            })
            .done(done, done);
        });

        it("saves sessions without a sessionId", function (done) {
            var session = {
                githubAccessToken: "xxx",
                username: "test"
            };
            return store.set("old", session)
            .then(function () {
                expect(session.sessionId).toBeDefined();
                expect(Object.keys(store.sessions).length).toEqual(1);
            })
            .done(done, done);
        });
    });

    describe("create", function () {
        it("returns a session with a no sessionId", function (done) {
            return store.create()
            .then(function (session) {
                expect(session.sessionId).toBeUndefined();
            })
            .done(done, done);
        });
    });


});
