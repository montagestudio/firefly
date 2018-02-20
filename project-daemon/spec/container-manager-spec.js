var Q = require("q");
var ContainerManager = require("../container-manager");
var MockDocker = require("./mocks/docker");
var makeContainerIndex = require("../make-container-index");
var SubdomainDetailsMap = require("../subdomain-details-map").SubdomainDetailsMap;
var PreviewDetails = require("../preview-details");
var uuid = require("uuid");

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
        it("returns the url", function (done) {
            containerManager.setup(new PreviewDetails("user", "owner", "repo"), "xxx", {})
            .then(function (addr) {
                expect(addr).toBe("user_owner_repo:2441");
            })
            .then(done, done);
        });

        it("adds a new service to the index", function (done) {
            var details = new PreviewDetails("user", "owner", "repo");
            containerManager.setup(details, "xxx", {})
            .then(function () {
                var entries = containerIndex.entries();
                expect(entries.length).toEqual(1);
                expect(entries[0][0]).toEqual(details);
            })
            .then(done, done);
        });

        it("removes a service from the index if it fails", function (done) {
            docker.createService = function () { return  Q.reject(new Error()); };
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

        it("doesn't create two services for one user/owner/repo", function (done) {
            spyOn(docker, "createService").andCallThrough();
            Q.all([
                containerManager.setup(new PreviewDetails("user", "owner", "repo"), "xxx", {}),
                containerManager.setup(new PreviewDetails("user", "owner", "repo"), "xxx", {})
            ])
            .then(function () {
                expect(docker.createService.callCount).toEqual(1);
            })
            .then(done, done);
        });

        it("discovers matching services already in the stack", function (done) {
            docker.listServices = function () {
                return Q([{
                    "ID": uuid.v4(),
                    "Spec": {
                        "Name": "user_owner_repo"
                    }
                }]);
            };
            spyOn(docker, "createService").andCallThrough();
            containerManager.setup(new PreviewDetails("user", "owner", "repo"), "xxx", {})
            .then(function () {
                expect(docker.createService.callCount).toEqual(0);
                var entries = containerIndex.entries();
                expect(entries.length).toEqual(1);
            })
            .then(done, done);
        });

        it("gives the service a useful name", function (done) {
            spyOn(docker, "createService").andCallThrough();
            containerManager.setup(new PreviewDetails("one-one", "two&two", "three123456three"), "xxx", {})
            .then(function () {
                expect(docker.createService.mostRecentCall.args[0].Name).toContain("one-one_twotwo_three123456three");
            })
            .then(done, done);
        });

        it("returns false if there's no service and no github access token or username are given", function (done) {
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
