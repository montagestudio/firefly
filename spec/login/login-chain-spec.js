var loginChain = require("../../login/login-chain");
var Q = require("q");
var MockFs = require("q-io/fs-mock");
var MockSession = require("../mocks/session");
var mockRequest = require("../mocks/request");

describe("login chain", function () {
    var request, sessions;
    beforeEach(function () {
        var fs = MockFs({
            "firefly-index.html": "pass",
            "login": {
                "index.html": "pass"
            },
            "project-list": {
                "index.html": "pass"
            }
        });
        sessions = {};
        var chain = loginChain({
            fs: fs,
            client: "/",
            sessions: MockSession(sessions),
            clientServices: {},
            directory: ".",
            minitPath: "."
        }).end();

        request = function (req) {
            return chain(mockRequest(req));
        };
    });

    describe("firefly index", function () {

        describe("when not authenticated", function () {

            it("serves login app at /", function (done) {
                request("http://127.0.0.1:2440/")
                .then(function (response) {
                    expect(response.status).toEqual(200);
                }).then(done, done);
            });

            it("redirects /user/repo", function (done) {
                request("http://127.0.0.1:2440/declarativ/filament")
                .then(function (response) {
                    expect(response.status).toEqual(302);
                })
                .then(done, done);
            });

        });

        describe("when authenticated", function () {
            var headers;
            beforeEach(function () {
                sessions["abc-123"] = {
                    githubUser: Q("test")
                };
                headers = {
                    "cookie": "session=abc-123"
                };
            });

            it("redirects / to /projects");

            it("serves project-list app at /projects", function (done) {
                request({
                    url: "http://127.0.0.1:2440/projects",
                    headers: headers
                })
                .then(function (response) {
                    expect(response.status).toEqual(200);
                }).then(done, done);
            });
        });
    });
});
