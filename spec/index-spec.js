var index = require("../index");
var MockFs = require("q-io/fs-mock");

describe("index", function () {

    it("serves index.html at /", function (done) {
        var fs = MockFs({
            "index.html": "pass"
        });
        return index({fs: fs, client: "/"})
        .then(function (server) {
            var request = require("joey").client();

            return request("http://127.0.0.1:8080")
            .then(function (response) {
                expect(response.status).toEqual(200);
                return response.body.read()
                .invoke('toString', 'utf-8')
                .then(console.log);

            }).finally(function () {
                return server.stop();
            });
        })
        .then(done, done);
    });

});
