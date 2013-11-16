var environment = require("../environment");

describe("environment", function () {
    describe("getProjectUrl", function () {
        it("returns a url", function () {
            expect(environment.getProjectUrl("owner/repo")).toEqual("http://owner-repo.project.127.0.0.1.xip.io:2441");
            expect(environment.getProjectUrl("/owner/repo")).toEqual("http://owner-repo.project.127.0.0.1.xip.io:2441");
            expect(environment.getProjectUrl("/owner/repo/fail")).toEqual("http://owner-repo.project.127.0.0.1.xip.io:2441");
        });
    });
});
