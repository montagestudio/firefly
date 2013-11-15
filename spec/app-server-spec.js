var appServer = require("../app-server");
var MockFs = require("q-io/fs-mock");
var MockSession = require("../mocks/session");

describe("app server", function () {
    var request, server;
    beforeEach(function (done) {
        var fs = MockFs({
            "index.html": "pass",
            "login": {
                "index.html": "pass"
            },
            "project-list": {
                "index.html": "pass"
            }
        });
        return appServer({
            fs: fs,
            client: "/",
            port: 2440,
            session: MockSession({}),
            clientServices: {}
        })
        .then(function (_server) {
            server = _server;
            request = require("joey").client();
        }).then(done, done);
    });

    afterEach(function (done) {
        server.stop().then(done, done);
    });

    describe("index", function () {

        it("serves index.html at /app", function (done) {
            request("http://127.0.0.1:2440/app")
            .then(function (response) {
                expect(response.status).toEqual(200);
            })
            .then(done, done);
        });

        it("serves index.html at /user/repo", function (done) {
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
