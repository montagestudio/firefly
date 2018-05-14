const projectChain = require("../chain");
const Q = require("q");
const mockRequest = require("./mocks/request");

const asyncTest = (test) => (done) =>
    Promise.resolve(test()).then(done).catch(done);

describe("project chain", () => {
    let username, containerManager, chain, request;
    beforeEach(() => {
        username = "jasmine";

        containerManager = {
            setup: async () => "1234",
            deleteUserContainers: jasmine.createSpy().andReturn(Q())
        };

        chain = projectChain({
            containerManager: containerManager,
            request: {
                async get(url) {
                    if (url === "http://jwt/profile") {
                        return {
                            data: {
                                profile: {
                                    username
                                },
                                token: "abc"
                            }
                        };
                    }
                }
            }
        }).end();

        request = (req) => chain(mockRequest(req));
    });

    describe("OPTIONS", function () {
        it("does not return any content", asyncTest(async () => {
            const response = await request({
                method: "OPTIONS",
                url: "http://localhost:2440/index.html"
            })
            expect(response.body.join("")).toEqual("");
        }));
    });

    describe("DELETE api/workspaces", function () {
        it("calls containerManager.delete with the container's details", asyncTest(async () => {
            const response = await request({
                method: "DELETE",
                url: "http://api.localhost:2440/workspaces",
                headers: {
                    "x-access-token": "abc"
                }
            });
            expect(response.status).toEqual(200);
            expect(response.body.join("")).toEqual('{"deleted":true}');
            expect(containerManager.deleteUserContainers).toHaveBeenCalledWith(username);
        }));
    });
});
