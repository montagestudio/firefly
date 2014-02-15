var Q = require("q");
var SetupProjectContainer = require("../../project/setup-project-container");
var MockDocker = require("../mocks/docker");
var makeContainerIndex = require("../../project/make-container-index");


describe("SetupProjectContainer", function () {
    var docker, containerIndex, setupProjectContainer;
    beforeEach(function () {
        docker = new MockDocker();
        containerIndex = makeContainerIndex();

        setupProjectContainer = SetupProjectContainer(docker, containerIndex, function () {
            // Shim `request` function
            return Q({
                status: 200,
                headers: {},
                body: []
            });
        });
    });

    it("returns the port", function (done) {
        setupProjectContainer("user", "owner", "repo", "xxx", {})
        .then(function (port) {
            // Port returned by MockDocker
            expect(port).toEqual("1234");
        })
        .then(done, done);
    });

    it("adds a new container to the index", function (done) {
        setupProjectContainer("user", "owner", "repo", "xxx", {})
        .then(function () {
            var entries = containerIndex.entries();
            expect(entries.length).toEqual(1);
            expect(entries[0][0]).toEqual({user: "user", owner: "owner", repo: "repo"});
        })
        .then(done, done);
    });

    it("removes a container from the index if it fails", function (done) {
        docker.createContainer = function () { return  Q.reject(new Error()); };
        setupProjectContainer("user", "owner", "repo", "xxx", {})
        .then(function () {
            // expect failure
            expect(false).toBe(true);
        }, function () {
            var entries = containerIndex.entries();
            expect(entries.length).toEqual(0);
        })
        .then(done, done);
    });

    it("doesn't create two containers for one user/owner/repo", function (done) {
        spyOn(docker, "createContainer").andCallThrough();
        Q.all([
            setupProjectContainer("user", "owner", "repo", "xxx", {}),
            setupProjectContainer("user", "owner", "repo", "xxx", {})
        ])
        .then(function () {
            expect(docker.createContainer.callCount).toEqual(1);
        })
        .then(done, done);
    });

});
