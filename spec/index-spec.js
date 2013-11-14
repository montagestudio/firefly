var index = require("../index");
var MockFs = require("q-io/fs-mock");

describe("server", function () {

    describe("index", function () {
        var request, server;
        beforeEach(function (done) {
            var fs = MockFs({
                "index.html": "pass"
            });
            return index({fs: fs, client: "/"})
            .then(function (_server) {
                server = _server;
                request = require("joey").client();
            }).then(done, done);
        });

        afterEach(function (done) {
            server.stop().then(done, done);
        });

        it("serves index.html at /app", function (done) {
            request("http://127.0.0.1:8080/app")
            .then(function (response) {
                expect(response.status).toEqual(200);
            })
            .then(done, done);
        });

        it("serves index.html at /user/repo", function (done) {
            request("http://127.0.0.1:8080/declarativ/filament")
            .then(function (response) {
                expect(response.status).toEqual(200);
            })
            .then(done, done);
        });

    });


    it("serves client adaptor at adaptor/client", function (done) {
        var fs = MockFs({
            "index.html": "pass"
        });
        return index({fs: fs, client: "/"})
        .then(function (server) {
            var request = require("joey").client();

            return request("http://127.0.0.1:8080/adaptor/client/ui/native/menu.js")
            .then(function (response) {
                expect(response.status).toEqual(200);
            }).finally(function () {
                return server.stop();
            });
        })
        .then(done, done);
    });

});
