var appChain = require("../app-chain");
var MockFs = require("q-io/fs-mock");
var MockSession = require("../mocks/session");

describe("app chain", function () {
    var request, server;
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
        return appChain({
            fs: fs,
            client: "/",
            session: MockSession({}),
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
        })
        .then(function (chain) {
            return chain.listen(2440);
        })
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

        it("serves firefly-index.html at /app", function (done) {
            request("http://127.0.0.1:2440/app")
            .then(function (response) {
                expect(response.status).toEqual(200);
            })
            .then(done, done);
        });

        it("serves firefly-index.html at /user/repo", function (done) {
            request("http://127.0.0.1:2440/declarativ/filament")
            .then(function (response) {
                expect(response.status).toEqual(200);
            })
            .then(done, done);
        });

    });

    it("serves login app at /", function (done) {
        request("http://127.0.0.1:2440/")
        .then(function (response) {
            expect(response.status).toEqual(200);
        }).then(done, done);
    });

    it("serves project-list app at /projects", function (done) {
        request("http://127.0.0.1:2440/projects")
        .then(function (response) {
            expect(response.status).toEqual(200);
        }).then(done, done);
    });

    it("serves client adaptor at adaptor/client", function (done) {
        request("http://127.0.0.1:2440/adaptor/client/ui/native/menu.js")
        .then(function (response) {
            expect(response.status).toEqual(200);
        }).then(done, done);
    });

});
