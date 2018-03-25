var Q = require("q");
var CheckSession = require("../check-session");

describe("CheckSession", function () {
    var checkSession, ok, notOk;

    beforeEach(function () {
        ok = jasmine.createSpy().andReturn("ok");
        notOk = jasmine.createSpy().andReturn("not ok");
        checkSession = CheckSession(ok, notOk);
    });

    it("defaults to redirect if no notOk function is given", function (done) {
        checkSession = CheckSession(ok);
        checkSession({})
        .then(function (response) {
            expect(response.status).toEqual(302);
            expect(response.headers.Location).toEqual("https://local.montage.studio:2440");
        })
        .done(done, done);
    });

    it("returns notOk(request) if there is no session", function (done) {
        var request = {};
        checkSession(request)
        .then(function (response) {
            expect(notOk).toHaveBeenCalledWith(request);
            expect(response).toEqual("not ok");
        })
        .done(done, done);
    });

    it("returns notOk(request) if there is no githubUser on the session", function (done) {
        var request = {session: {}};
        checkSession(request)
        .then(function (response) {
            expect(notOk).toHaveBeenCalledWith(request);
            expect(response).toEqual("not ok");
        })
        .done(done, done);
    });

    it("returns notOk(request) if there is no githubUser on the session", function (done) {
        var request = {session: {}};
        checkSession(request)
        .then(function (response) {
            expect(notOk).toHaveBeenCalledWith(request);
            expect(response).toEqual("not ok");
        })
        .done(done, done);
    });

    it("returns notOk(request) if there is no githubUser on the session", function (done) {
        var request = {session: {}};
        checkSession(request)
        .then(function (response) {
            expect(notOk).toHaveBeenCalledWith(request);
            expect(response).toEqual("not ok");
        })
        .done(done, done);
    });

    it("returns ok(request) if there is a valid githubUser", function (done) {
        var request = {session: {githubUser: Q({})}};
        checkSession(request)
        .then(function (response) {
            expect(ok).toHaveBeenCalledWith(request);
            expect(response).toEqual("ok");
        })
        .done(done, done);
    });

    it("returns notOk(request) if there is not a valid githubUser", function (done) {
        var request = {session: {githubUser: Q(void 0)}};
        checkSession(request)
        .then(function (response) {
            expect(notOk).toHaveBeenCalledWith(request);
            expect(response).toEqual("not ok");
        })
        .done(done, done);
    });

    it("returns notOk(request) if there is an error getting githubUser", function (done) {
        var request = {session: {githubUser: Q.reject(new Error())}};
        checkSession(request)
        .then(function (response) {
            expect(notOk).toHaveBeenCalledWith(request);
            expect(response).toEqual("not ok");
        })
        .done(done, done);
    });
});
