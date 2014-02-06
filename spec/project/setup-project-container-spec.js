var Q = require("q");
var SetupProjectContainer = require("../../project/setup-project-container");
var mockRequest = require("../mocks/request");
var MockDocker = require("../mocks/docker");
var makeContainerIndex = require("../../project/make-container-index");


describe("SetupProjectContainer", function () {
    var docker, containerIndex, request, next, requestOpts;
    beforeEach(function () {
        docker = new MockDocker();
        containerIndex = makeContainerIndex();
        next = jasmine.createSpy();

        var app = SetupProjectContainer(docker, containerIndex, function () {
            // Shim `request` function
            return Q({
                status: 200,
                headers: {},
                body: []
            });
        })(next);

        request = function (req) {
            return app(mockRequest(req));
        };

        // Some default options to use
        requestOpts = {
            url: "http://127.0.0.1:2440/",
            session: {username: "one", githubUser: Q()},
            params: {
                owner: "two",
                repo: "three"
            }
        };
    });

    it("works", function (done) {
        request(requestOpts).then(done, done);
    });

    it("adds a new container to the index", function (done) {
        request(requestOpts)
        .then(function () {
            var entries = containerIndex.entries();
            expect(entries.length).toEqual(1);
            expect(entries[0][0]).toEqual({user: "one", owner: "two", repo: "three"});
        })
        .then(done, done);
    });

    it("doesn't create two containers for one user/owner/repo", function (done) {
        spyOn(docker, "createContainer").andCallThrough();
        Q.all([
            request(requestOpts),
            request(requestOpts)
        ])
        .then(function () {
            expect(docker.createContainer.callCount).toEqual(1);
        })
        .then(done, done);
    });

});
