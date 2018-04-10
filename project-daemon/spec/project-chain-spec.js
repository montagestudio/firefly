var projectChain = require("../chain");
var Q = require("q");
var mockRequest = require("../common/spec/mocks/request");
var jwt = require("../common/jwt");

describe("project chain", function () {
    var username, userStackManager, chain, request;
    beforeEach(function () {
        username = "jasmine";

        userStackManager = {
            setup: function () { return Q("1234"); },
            delete: jasmine.createSpy().andReturn(Q()),
            deleteAll: jasmine.createSpy().andReturn(Q())
        };

        chain = projectChain({
            userStackManager: userStackManager
        }).end();

        request = function (req) {
            return chain(mockRequest(req));
        };
    });

    describe("OPTIONS", function () {
        it("does not return any content", function (done) {
            request({
                method: "OPTIONS",
                url: "http://localhost:2440/index.html"
            })
            .then(function (response) {
                expect(response.body.join("")).toEqual("");
            })
            .done(done, done);
        });
    });

    describe("DELETE api/workspaces", function () {
        it("calls userStackManager.delete with the container's details", function (done) {
            jwt.sign({
                githubUser: {
                    login: username
                }
            }).then(function (token) {
                return request({
                    method: "DELETE",
                    url: "http://api.localhost:2440/workspaces",
                    headers: {
                        "x-access-token": token
                    }
                });
            }).then(function (response) {
                expect(response.status).toEqual(200);
                expect(response.body.join("")).toEqual('{"deleted":true}');
                expect(userStackManager.deleteAll).toHaveBeenCalledWith({ login: username });
            }).then(done, done);
        });
    });
});
