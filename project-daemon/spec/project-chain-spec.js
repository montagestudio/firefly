var projectChain = require("../chain");
var Q = require("q");
var mockRequest = require("../common/spec/mocks/request");

describe("project chain", function () {
    var username, userStackManager, chain, request;
    beforeEach(function () {
        username = "jasmine";

        userStackManager = {
            setup: function () { return Q("1234"); },
            removeUserStacks: jasmine.createSpy().andReturn(Q())
        };

        chain = projectChain({
            userStackManager: userStackManager,
            request: {
                get: function (url, options) {
                    if (url === "http://jwt/profile") {
                        return Promise.resolve({
                            data: {
                                profile: {
                                    username: username
                                },
                                token: "abc"
                            }
                        });
                    }
                    return Promise.resolve();
                }
            }
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
            return request({
                method: "DELETE",
                url: "http://api.localhost:2440/workspaces",
                headers: {
                    "x-access-token": "abc"
                }
            }).then(function (response) {
                expect(response.status).toEqual(200);
                expect(response.body.join("")).toEqual('{"deleted":true}');
                expect(userStackManager.removeUserStacks).toHaveBeenCalledWith(username);
            }).then(done, done);
        });
    });
});
