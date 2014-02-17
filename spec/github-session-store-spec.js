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
                pass: true
            };
            return store.set("old", session)
            .then(function () {
                expect(session.id).not.toEqual("fail");
            })
            .done(done, done);
        });
    });

    describe("create", function () {
        it("returns a session with a blank sessionId", function (done) {
            return store.create()
            .then(function (session) {
                expect(session.sessionId).toEqual("");
            })
            .done(done, done);
        });
    });


});
