var loginChain = require("../login-chain");
var MockFs = require("q-io/fs-mock");
var MockSession = require("../mocks/session");

describe("login chain", function () {
    var request, server, sessions;
    beforeEach(function (done) {
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
            setupProjectWorkspace: function (fs, directory, minitPath) {
                return function(next) {
                    return function(request, response) {
                        return next(request, response);
                    };
                };
            },
            directory: ".",
            minitPath: "."
        });

        return chain.listen(2440)
        .then(function (_server) {
            server = _server;
            request = require("joey").client();
        })
        .then(done, done);
    });

    afterEach(function (done) {
        server.stop().then(done, done);
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

            it("serves client adaptor at adaptor/client", function (done) {
                request("http://127.0.0.1:2440/app/adaptor/client/core/menu.js")
                .then(function (response) {
                    expect(response.status).toEqual(200);
                }).then(done, done);
            });
        });

        describe("when authenticated", function () {
            var headers;
            beforeEach(function () {
                sessions["abc-123"] = {
                    githubUser: "test"
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
