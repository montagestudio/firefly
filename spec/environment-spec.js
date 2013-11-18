var Env = require("../environment").Env;

describe("environment", function () {
    var environment;
    describe("in developement", function () {
        beforeEach(function () {
            environment = Env();
        });
        describe("getProjectUrlFromAppUrl", function () {
            it("returns a url", function () {
                expect(environment.getProjectUrlFromAppUrl("owner/repo")).toEqual("http://owner-repo.project.127.0.0.1.xip.io:2441");
                expect(environment.getProjectUrlFromAppUrl("/owner/repo")).toEqual("http://owner-repo.project.127.0.0.1.xip.io:2441");
                expect(environment.getProjectUrlFromAppUrl("/owner/repo/fail")).toEqual("http://owner-repo.project.127.0.0.1.xip.io:2441");
            });
        });
    });
    describe("in production", function () {
        beforeEach(function () {
            environment = Env({  production: true });
        });
        describe("getProjectUrlFromAppUrl", function () {
            it("returns a url", function () {
                expect(environment.getProjectUrlFromAppUrl("owner/repo")).toEqual("http://p0.project.127.0.0.1.xip.io");
                expect(environment.getProjectUrlFromAppUrl("/owner/repo2")).toEqual("http://p1.project.127.0.0.1.xip.io");
                expect(environment.getProjectUrlFromAppUrl("/owner/repo3/fail")).toEqual("http://p2.project.127.0.0.1.xip.io");
            });
            it("can be recovered from the project domain", function () {
                var detail = environment.getDetailsfromProjectUrl(environment.getProjectUrlFromAppUrl("owner/repo"));
                expect(detail.owner).toEqual("owner");
                expect(detail.repo).toEqual("repo");
            });
            it("should return a stable url", function () {
                expect(environment.getProjectUrlFromAppUrl("owner/repo")).toEqual("http://p0.project.127.0.0.1.xip.io");
                expect(environment.getProjectUrlFromAppUrl("/owner/repo")).toEqual("http://p0.project.127.0.0.1.xip.io");
            });
        });
    });

});
