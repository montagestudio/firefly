var loginChain = require("../chain");
var mockRequest = require("../common/spec/mocks/request");
var jwt = require("../common/jwt");

describe("login chain", function () {
    var request, accessToken;
    beforeEach(function (done) {
        var chain = loginChain({ }).end();

        request = function (req) {
            return chain(mockRequest(req));
        };

        var githubUser = {
            login: "Montage"
        };
        jwt.sign({githubUser: githubUser}).then(function (token) {
            accessToken = token;
        }).then(done, done);
    });

    describe("/", function () {
        it("returns 200 when authenticated", function (done) {
            var headers = {
                "x-access-token": accessToken
            };

            return request({
                url: "http://auth.localhost:2440/",
                headers: headers
            }).then(function (response) {
                expect(response.status).toBe(200);
            }).then(done, done);
        });

        it("returns 401 when not authenticated", function (done) {
            request("http://auth.localhost:2440/")
            .then(function (response) {
                expect(response.status).toBe(401);
            }).then(done, done);
        });
    });
});
