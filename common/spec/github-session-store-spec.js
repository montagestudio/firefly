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
                expect(session.sessionId.length).toBeGreaterThan(39);
                expect(Object.keys(store.sessions).length).toEqual(1);
            })
            .done(done, done);
        });

        it("uses a UUID for sessions without Github access Token and username", function (done) {
            var session = {
                pass: true
            };
            return store.set("old", session)
            .then(function () {
                expect(session.sessionId).toBeDefined();
                expect(session.sessionId.length).toEqual(36);
                expect(Object.keys(store.sessions).length).toEqual(1);
            })
            .done(done, done);
        });

        it("changes the sessionId when username changes", function (done) {
            var id = "test";
            store.sessions[id] = {sessionId: id};
            return store.get(id)
            .then(function (session) {
                session.username = "test";
                session.githubAccessToken = "xxx";
                return store.set(null, session)
                .then(function () {
                    expect(session.sessionId).not.toEqual(id);
                    expect(session.sessionId.length).toBeGreaterThan(39);
                });
            })
            .done(done, done);
        });

        it("does not change the sessionId when non-key fields change", function (done) {
            var id = "test";
            store.sessions[id] = {sessionId: id, __previousKey: ""};
            return store.get(id)
            .then(function (session) {
                session.other = "test";
                return store.set(null, session)
                .then(function () {
                    expect(session.sessionId).toEqual(id);
                });
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
