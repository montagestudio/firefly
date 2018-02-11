var Q = require("q");
var ContainerManager = require("../../project-daemon/container-manager");
var MockDocker = require("../mocks/docker");
var makeContainerIndex = require("../../project-daemon/make-container-index");
var SubdomainDetailsMap = require("../../project-daemon/subdomain-details-map").SubdomainDetailsMap;
var PreviewDetails = require("../../project-daemon/preview-details");

describe("ContainerManager", function () {
    var docker, containerIndex, subdomainDetailsMap, containerManager;
    beforeEach(function () {
        docker = new MockDocker();
        containerIndex = makeContainerIndex();
        subdomainDetailsMap = new SubdomainDetailsMap();

        containerManager = new ContainerManager(docker, containerIndex, subdomainDetailsMap, function () {
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
        it("returns the port", function (done) {
            containerManager.setup(new PreviewDetails("user", "owner", "repo"), "xxx", {})
            .then(function (addr) {
                expect(addr).toEqual("172.17.100.100:2441");
            })
            .then(done, done);
        });

        it("adds a new container to the index", function (done) {
            var details = new PreviewDetails("user", "owner", "repo");
            containerManager.setup(details, "xxx", {})
            .then(function () {
                var entries = containerIndex.entries();
                expect(entries.length).toEqual(1);
                expect(entries[0][0]).toEqual(details);
            })
            .then(done, done);
        });

        it("removes a container from the index if it fails", function (done) {
            docker.createContainer = function () { return  Q.reject(new Error()); };
            containerManager.setup(new PreviewDetails("user", "owner", "repo"), "xxx", {})
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
                containerManager.setup(new PreviewDetails("user", "owner", "repo"), "xxx", {}),
                containerManager.setup(new PreviewDetails("user", "owner", "repo"), "xxx", {})
            ])
            .then(function () {
                expect(docker.createContainer.callCount).toEqual(1);
            })
            .then(done, done);
        });

        it("gives the container a useful name", function (done) {
            spyOn(docker, "createContainer").andCallThrough();
            containerManager.setup(new PreviewDetails("one-one", "two&two", "three123456three"), "xxx", {})
            .then(function () {
                expect(docker.createContainer.mostRecentCall.args[0].name).toContain("one-one_twotwo_three123456three");
            })
            .then(done, done);
        });

        it("returns false if there's no container and no github access token or username are given", function (done) {
            containerManager.setup(new PreviewDetails("user", "owner", "repo"))
            .then(function (port) {
                expect(port).toBe(false);
            })
            .then(done, done);
        });

        it("creates a subdomain for the details", function (done) {
            var details = new PreviewDetails("user", "owner", "repo");
            containerManager.setup(details, "xxx", {})
            .then(function () {
                expect(typeof subdomainDetailsMap.subdomainFromDetails(details)).toEqual("string");
            })
            .then(done, done);
        });
    });


});
