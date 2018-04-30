var Q = require("q");
var ContainerManager = require("../container-manager");
var MockDocker = require("./mocks/docker");
var ProjectInfo = require("../project-info");

describe("ContainerManager", function () {
    var docker, containerManager;
    beforeEach(function () {
        docker = new MockDocker();

        containerManager = new ContainerManager(docker, function () {
            // Shim `request` function
            return Q({
                status: 200,
                headers: {},
                body: []
            });
        });
        containerManager.GithubService = function() {
            this.getRepo = function() {
                return Q.resolve({
                    private: false
                });
            };
        };
    });

    describe("setup", function () {
        it("creates a new container", function (done) {
            var details = new ProjectInfo("user", "owner", "repo");
            spyOn(docker, "createContainer").andCallThrough();
            containerManager.setup(details, "xxx", {})
            .then(function () {
                expect(docker.createContainer.callCount).toEqual(1);
            })
            .then(done, done);
        });

        it("returns the host", function (done) {
            containerManager.setup(new ProjectInfo("user", "owner", "repo"), "xxx", {})
            .then(function (host) {
                expect(host).toEqual("firefly-project_user_owner_repo:2441");
            })
            .then(done, done);
        });

        it("removes a container if it fails", function (done) {
            docker.createContainer = function () { return  Q.reject(new Error()); };
            containerManager.setup(new ProjectInfo("user", "owner", "repo"), "xxx", {})
            .then(function () {
                // expect failure
                expect(false).toBe(true);
            }, function () {
                return docker.listContainers()
                    .then(function (containers) {
                        expect(containers.length).toEqual(0);
                    });
            })
            .then(done, done);
        });

        it("doesn't create two containers for one user/owner/repo", function (done) {
            spyOn(docker, "createContainer").andCallThrough();
            Q.all([
                containerManager.setup(new ProjectInfo("user", "owner", "repo"), "xxx", {}),
                containerManager.setup(new ProjectInfo("user", "owner", "repo"), "xxx", {})
            ])
            .then(function () {
                expect(docker.createContainer.callCount).toEqual(1);
            })
            .then(done, done);
        });

        it("gives the container a useful name", function (done) {
            spyOn(docker, "createContainer").andCallThrough();
            containerManager.setup(new ProjectInfo("one-one", "twotwo", "three123456three"), "xxx", {})
            .then(function () {
                expect(docker.createContainer.mostRecentCall.args[0].name).toContain("one-one_twotwo_three123456three");
            })
            .then(done, done);
        });

        it("throws if there's no container and no github access token or username are given", function (done) {
            containerManager.setup(new ProjectInfo("user", "owner", "repo"))
            .then(function (port) {
                expect(false).toBe(true);
            }, function () {
                return docker.listContainers()
                    .then(function (containers) {
                        expect(containers.length).toEqual(0);
                    });
            })
            .then(done, done);
        });

        it("creates a subdomain for the details", function (done) {
            var details = new ProjectInfo("user", "owner", "repo");
            containerManager.setup(details, "xxx", {})
            .then(function () {
                expect(typeof details.toPath()).toEqual("string");
            })
            .then(done, done);
        });
    });
});
