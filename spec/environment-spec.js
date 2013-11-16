var environment = require("../environment");

describe("environment", function () {
    describe("getProjectUrlFromAppUrl", function () {
        it("returns a url", function () {
            expect(environment.getProjectUrlFromAppUrl("owner/repo")).toEqual("http://owner-repo.project.127.0.0.1.xip.io:2441");
            expect(environment.getProjectUrlFromAppUrl("/owner/repo")).toEqual("http://owner-repo.project.127.0.0.1.xip.io:2441");
            expect(environment.getProjectUrlFromAppUrl("/owner/repo/fail")).toEqual("http://owner-repo.project.127.0.0.1.xip.io:2441");
        });
    });
});
