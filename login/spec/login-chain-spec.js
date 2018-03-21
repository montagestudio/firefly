var loginChain = require("../chain");
var Q = require("q");
var MockSession = require("../common/spec/mocks/session");
var mockRequest = require("../common/spec/mocks/request");

describe("login chain", function () {
    var request, sessions;
    beforeEach(function () {
        var mockStaticFiles = {
            "http://static/app/firefly-index.html": "pass",
            "http://static/app/login/index.html": "login",
            "http://static/app/project-list/index.html": "projects"
        };
        var proxyMiddlewareMock = function (path) {
            return function () {
                var body = mockStaticFiles[path];
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

    describe("firefly index", function () {

        describe("when not authenticated", function () {

            it("serves login app at /", function (done) {
                request("http://127.0.0.1:2440/")
                .then(function (response) {
                    expect(response.status).toEqual(200);
                    expect(response.body.toString("utf8")).toEqual("login");
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
                    username: "test",
                    githubUser: Q({})
                };
                headers = {
                    "cookie": "session=abc-123"
                };
            });

            it("serves project-list app at /", function (done) {
                request({
                    url: "http://127.0.0.1:2440/",
                    headers: headers
                })
                .then(function (response) {
                    expect(response.status).toEqual(200);
                    expect(response.body.toString("utf8")).toEqual("projects");
                }).then(done, done);
            });
        });
    });
});
