const Q = require("q");
const ContainerManager = require("../container-manager");
const MockDocker = require("./mocks/docker");
const ProjectInfo = require("../project-info");

const asyncTest = (test) => (done) =>
    Promise.resolve(test()).then(done).catch(done);

describe("ContainerManager", () => {
    let docker, containerManager;
    beforeEach(() => {
        docker = new MockDocker();

        containerManager = new ContainerManager(docker, () => {
            // Shim `request` function
            return Q({
                status: 200,
                headers: {},
                body: []
            });
        });
        class MockGithubApi {
            authenticate() { }
        }
        containerManager.GithubApi = MockGithubApi;
        MockGithubApi.prototype.repos = {
            get(args, cb) {
                cb(null, { private: false });
            }
        }
    });

    describe("setup", () => {
        it("creates a new container", asyncTest(async () => {
            const details = new ProjectInfo("user", "owner", "repo");
            spyOn(docker, "createContainer").andCallThrough();
            await containerManager.setup(details, "xxx", {});
            expect(docker.createContainer.callCount).toEqual(1);
        }));

        it("returns the host", asyncTest(async () => {
            const host = await containerManager.setup(new ProjectInfo("user", "owner", "repo"), "xxx", {})
            expect(host).toEqual("firefly-project_user_owner_repo:2441");
        }));

        it("removes a container if it fails", asyncTest(async () => {
            docker.createContainer = async () => new Error();
            try {
                await containerManager.setup(new ProjectInfo("user", "owner", "repo"), "xxx", {});
                // expect failure
                expect(false).toBe(true);
            } catch (e) {
                const containers = await docker.listContainers();
                expect(containers.length).toEqual(0);
            }
        }));

        it("doesn't create two containers for one user/owner/repo", asyncTest(async () => {
            spyOn(docker, "createContainer").andCallThrough();
            await Promise.all([
                containerManager.setup(new ProjectInfo("user", "owner", "repo"), "xxx", {}),
                containerManager.setup(new ProjectInfo("user", "owner", "repo"), "xxx", {})
            ]);
            expect(docker.createContainer.callCount).toEqual(1);
        }));

        it("gives the container a useful name", asyncTest(async () => {
            spyOn(docker, "createContainer").andCallThrough();
            await containerManager.setup(new ProjectInfo("one-one", "twotwo", "three123456three"), "xxx", {});
            expect(docker.createContainer.mostRecentCall.args[0].name).toContain("one-one_twotwo_three123456three");
        }));

        it("throws if there's no container and no github access token or username are given", asyncTest(async () => {
            try {
                await containerManager.setup(new ProjectInfo("user", "owner", "repo"))
                expect(false).toBe(true);
            } catch (e) {
                const containers = await docker.listContainers();
                expect(containers.length).toEqual(0);
            }
        }));

        it("creates a subdomain for the details", asyncTest(async () => {
            const details = new ProjectInfo("user", "owner", "repo");
            await containerManager.setup(details, "xxx", {});
            expect(typeof details.toPath()).toEqual("string");
        }));
    });
});
