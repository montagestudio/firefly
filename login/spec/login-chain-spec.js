var loginChain = require("../chain");
var Q = require("q");
var MockSession = require("../common/spec/mocks/session");
var mockRequest = require("../common/spec/mocks/request");

describe("login chain", function () {
    var request, sessions;
    beforeEach(function () {
        var proxyMiddlewareMock = function (path) {
            return function () {
                var body = "app";
                return Q({
                    status: body ? 200 : 404,
                    headers: {
                        "content-type": "text/html"
                    },
                    body: body
                });
            };
        };
        sessions = {};
        var chain = loginChain({
            sessions: MockSession(sessions),
            proxyMiddleware: proxyMiddlewareMock
        }).end();

        request = function (req) {
            return chain(mockRequest(req));
        };
    });

    describe("/auth", function () {
        it("returns 200 when authenticated", function (done) {
            var headers = {
                "Authorization": "Basic abc"
            };

            request({
                url: "http://localhost:2440/auth",
                headers: headers
            }).then(function (response) {
                expect(response.status).toBe(200);
            }).then(done, done);
        });

        it("returns 401 when not authenticated", function (done) {
            request("http://localhost:2440/auth")
            .then(function (response) {
                expect(response.status).toBe(401);
            }).then(done, done);
        });
    });

    describe("firefly index", function () {

        describe("when not authenticated", function () {

            it("serves app at /", function (done) {
                request("http://127.0.0.1:2440/")
                .then(function (response) {
                    expect(response.status).toEqual(200);
                    expect(response.body.toString("utf8")).toEqual("app");
                }).then(done, done);
            });

            it("serves app at /user/repo", function (done) {
                request("http://127.0.0.1:2440/declarativ/filament")
                .then(function (response) {
                    expect(response.status).toEqual(200);
                    expect(response.body.toString("utf8")).toEqual("app");
                })
                .then(done, done);
            });

        });

        describe("when authenticated", function () {
            var headers;
            beforeEach(function () {
                headers = {
                    "Authorization": "Basic abc"
                };
            });

            it("serves app at /", function (done) {
                request({
                    url: "http://127.0.0.1:2440/",
                    headers: headers
                })
                .then(function (response) {
                    expect(response.status).toEqual(200);
                    expect(response.body.toString("utf8")).toEqual("app");
                }).then(done, done);
            });
        });
    });
});
