var apiChain = require("../../container/api");
var Promise = require("bluebird");
var mockRequest = require("../mocks/request");

describe("api", function () {
    var config, chain, request, projectWorkspace;
    beforeEach(function () {
        config = {
            owner: "owner",
            repo: "repo"
        };

        projectWorkspace = {};

        chain = apiChain(config).end();

        request = function (req) {
            req = mockRequest(req);
            req.projectWorkspace = projectWorkspace;
            return Promise.resolve(chain(req));
        };
    });

    describe("/init", function () {
        var url;
        beforeEach(function () {
            url = "/init";
            projectWorkspace.initializeWorkspace = jasmine.createSpy("initializeWorkspace").andReturn(Promise.resolve());
        });

        it("doesn't respond to GET", function (done) {
            request({
                method: "GET",
                url: url
            }).then(function (response) {
                expect(response.status).toEqual(404);
            }).then(done, done);
        });

        it("calls initializeWorkspace", function (done) {
            request({
                method: "POST",
                url: url
            })
            .then(function (response) {
                expect(projectWorkspace.initializeWorkspace).toHaveBeenCalled();
            }).then(done, done);
        });

        it("returns initializing message", function (done) {
            request({
                method: "POST",
                url: url
            })
            .then(function (response) {
                var object = JSON.parse(response.body);
                expect(object.message).toEqual("initializing");
            }).then(done, done);
        });
    });

    // TODO more
});
