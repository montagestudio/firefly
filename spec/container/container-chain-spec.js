var containerChain = require("../../container/container-chain");
var Q = require("q");
var MockFs = require("q-io/fs-mock");
var mockRequest = require("../mocks/request");

describe("container chain", function () {
    var config, chain, request, projectWorkspace;
    beforeEach(function () {
        config = {
            owner: "owner",
            repo: "repo",
            githubAccessToken: "0000000000000000",
            githubUser: {}
        };

        projectWorkspace = {};

        chain = containerChain({
            setupProjectWorkspace: function (request) {
                request.projectWorkspace = projectWorkspace;
            },
            config: config,
            workspacePath: "/workspace",
            fs: MockFs({
                "bad.html": "fail",
                "client": {},
                "workspace": {
                    "index.html": "pass"
                }
            }),
            client: "/client",
            clientServices: []
        }).end();

        request = function (req) {
            return chain(mockRequest(req));
        };
    });

    describe("OPTIONS", function () {
        it("returns empty 200 response", function (done) {
            request({
                method: "OPTIONS",
                url: "http://127.0.0.1:2440/"
            })
            .then(function (response) {
                expect(response.status).toEqual(200);
            }).then(done, done);
        });
    });

    describe("/api", function () {
        // This is just to check that we are routing the /api path correctly.
        // The main specs are in api-spec.js

        it("/init calls initializeWorkspace", function (done) {
            var url = "http://127.0.0.1:2440/api/init";
            projectWorkspace.initializeWorkspace = jasmine.createSpy().andReturn(Q());

            request({
                method: "POST",
                url: url
            })
            .then(function (response) {
                expect(projectWorkspace.initializeWorkspace).toHaveBeenCalled();
            }).then(done, done);
        });
    });

    describe("/static", function () {
        it("serves an existing file", function (done) {
            request("http://127.0.0.1:2440/static/index.html")
            .then(function (response) {
                expect(response.status).toEqual(200);
                expect(response.body[0]).toContain("pass");
            }).then(done, done);
        });

        it("returns 404 for a missing file", function (done) {
            request("http://127.0.0.1:2440/static/missing.html")
            .then(function (response) {
                expect(response.status).toEqual(404);
            }).then(done, done);
        });

        it("does not serve files outside of workspace", function (done) {
            request("http://127.0.0.1:2440/static/../bad.html")
            .then(function (response) {
                expect(response.status).toEqual(404);
            }).then(done, done);
        });
    });

    describe("/notice", function () {
        var url;
        beforeEach(function () {
            url = "http://127.0.0.1:2440/notice";
        });

        it("doesn't respond to GET", function (done) {
            request({
                method: "GET",
                url: url
            }).then(function (response) {
                expect(response.status).toEqual(404);
            }).then(done, done);
        });

        it("calls Frontend.showNotification", function (done) {
            var Frontend = require("../../container/frontend");
            var original = Frontend.showNotification;
            Frontend.showNotification = jasmine.createSpy("showNotification").andReturn(Q());
            request({
                method: "POST",
                url: url,
                body: ['"pass"']
            }).then(function (response) {
                expect(response.status).toEqual(200);
                expect(Frontend.showNotification).toHaveBeenCalled();
                expect(Frontend.showNotification.mostRecentCall.args[0]).toEqual("pass");
            }).finally(function () {
                Frontend.showNotification = original;
            }).then(done, done);
        });
    });

});
