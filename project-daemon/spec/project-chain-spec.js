var projectChain = require("../chain");
var Q = require("q");
var mockRequest = require("../common/spec/mocks/request");
var makeContainerIndex = require("../make-container-index");
var jwt = require("../common/jwt");

describe("project chain", function () {
    var username, containerManager, containerIndex, chain, request;
    beforeEach(function () {
        username = "jasmine";

        containerManager = {
            setup: function () { return Q("1234"); },
            delete: jasmine.createSpy().andReturn(Q())
        };
        containerIndex = makeContainerIndex();

        chain = projectChain({
            containerManager: containerManager,
            containerIndex: containerIndex
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
        it("calls containerManager.delete with the container's details", function (done) {
            var details = {username: username, owner: username, repo: "repo"};
            containerIndex.set(details, null);

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
                expect(containerManager.delete).toHaveBeenCalledWith(details);
            }).then(done, done);
        });
    });
});
