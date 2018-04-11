var Q = require("q");
var UserStackManager = require("../user-stack-manager");
var MockDocker = require("./mocks/docker");
var ProjectInfo = require("../project-info");

describe("UserStackManager", function () {
    var docker, userStackManager;
    beforeEach(function () {
        docker = new MockDocker();

        userStackManager = new UserStackManager(docker, function () {
            // Shim `request` function
            return Q({
                status: 200,
                headers: {},
                body: []
            });
        });
        userStackManager.GithubService = function() {
            this.getRepo = function() {
                return Q.resolve({
                    private: false
                });
            };
        };
    });

    describe("setup", function () {
        it("returns the url", function (done) {
            userStackManager.setup(new ProjectInfo("user", "owner", "repo"), "xxx", {})
            .then(function (addr) {
                expect(addr).toBe("user_owner_repo:2441");
            })
            .then(done, done);
        });

        it("creates new stacks", function (done) {
            var details = new ProjectInfo("user", "owner", "repo");
            spyOn(docker, "deployStack").andCallThrough();
            userStackManager.setup(details, "xxx", {})
            .then(function () {
                expect(docker.deployStack.callCount).toEqual(1);
            })
            .then(done, done);
        });

        it("removes a stack if it fails", function (done) {
            docker.deployStack = function () { return  Q.reject(new Error()); };
            userStackManager.setup(new ProjectInfo("user", "owner", "repo"), "xxx", {})
            .then(function () {
                // expect failure
                expect(false).toBe(true);
            }, function () {
                expect(docker.stacks.length).toEqual(0);
            })
            .then(done, done);
        });

        // TODO: Fix this race condition
        xit("doesn't create two stacks for one user/owner/repo", function (done) {
            spyOn(docker, "deployStack").andCallThrough();
            Q.all([
                userStackManager.setup(new ProjectInfo("user", "owner", "repo"), "xxx", {}),
                userStackManager.setup(new ProjectInfo("user", "owner", "repo"), "xxx", {})
            ])
            .then(function () {
                expect(docker.deployStack.callCount).toEqual(1);
            })
            .then(done, done);
        });

        it("gives the stack a useful name", function (done) {
            spyOn(docker, "deployStack").andCallThrough();
            userStackManager.setup(new ProjectInfo("one-one", "twotwo", "three123456three"), "xxx", {})
            .then(function () {
                expect(docker.deployStack.mostRecentCall.args[0]).toContain("one-one_twotwo_three123456three");
            })
            .then(done, done);
        });

        it("throws if there's no stack and no github access token or username are given", function (done) {
            userStackManager.setup(new ProjectInfo("user", "owner", "repo"))
            .then(function (port) {
                expect(false).toBe(true);
            }, function () {
                expect(docker.stacks.length).toEqual(0);
            })
            .then(done, done);
        });

        it("creates a subdomain for the details", function (done) {
            var details = new ProjectInfo("user", "owner", "repo");
            userStackManager.setup(details, "xxx", {})
            .then(function () {
                expect(typeof details.toPath()).toEqual("string");
            })
            .then(done, done);
        });
    });


});
