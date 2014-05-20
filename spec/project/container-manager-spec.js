var Q = require("q");
var ContainerManager = require("../../project/container-manager");
var MockDocker = require("../mocks/docker");
var makeContainerIndex = require("../../project/make-container-index");


describe("ContainerManager", function () {
    var docker, containerIndex, containerManager;
    beforeEach(function () {
        docker = new MockDocker();
        containerIndex = makeContainerIndex();

        containerManager = new ContainerManager(docker, containerIndex, function () {
            // Shim `request` function
            return Q({
                status: 200,
                headers: {},
                body: []
            });
        });
    });

    describe("setup", function () {
        it("returns the port", function (done) {
            containerManager.setup("user", "owner", "repo", "xxx", {})
            .then(function (port) {
                // Port returned by MockDocker
                expect(port).toEqual("1234");
            })
            .then(done, done);
        });

        it("adds a new container to the index", function (done) {
            containerManager.setup("user", "owner", "repo", "xxx", {})
            .then(function () {
                var entries = containerIndex.entries();
                expect(entries.length).toEqual(1);
                expect(entries[0][0]).toEqual({user: "user", owner: "owner", repo: "repo"});
            })
            .then(done, done);
        });

        it("removes a container from the index if it fails", function (done) {
            docker.createContainer = function () { return  Q.reject(new Error()); };
            containerManager.setup("user", "owner", "repo", "xxx", {})
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
                containerManager.setup("user", "owner", "repo", "xxx", {}),
                containerManager.setup("user", "owner", "repo", "xxx", {})
            ])
            .then(function () {
                expect(docker.createContainer.callCount).toEqual(1);
            })
            .then(done, done);
        });

        it("gives the container a useful name", function (done) {
            spyOn(docker, "createContainer").andCallThrough();
            containerManager.setup("one-one", "two&two", "three123456three", "xxx", {})
            .then(function () {
                expect(docker.createContainer.mostRecentCall.args[0].name).toContain("one-one_twotwo_three123456three");
            })
            .then(done, done);
        });

        it("returns false if there's no container and no github access token or username are given", function (done) {
            containerManager.setup("user", "owner", "repo")
            .then(function (port) {
                expect(port).toBe(false);
            })
            .then(done, done);
        });
    });


});
