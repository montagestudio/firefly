var Env = require("../environment").Env;
var getHost = require("../environment").getHost;
var MockFs = require("q-io/fs-mock");

describe("environment", function () {
    var environment;
    describe("in developement", function () {
        beforeEach(function () {
            var fs = MockFs({});

            environment = Env();
            environment.configure(fs, "/clone");
        });

        describe("getAppUrl", function () {
            it("returns a url", function () {
                expect(environment.getAppUrl()).toEqual("http://local-firefly.declarativ.net:2440");
            });
        });

        describe("getProjectUrlFromAppUrl", function () {
            it("returns a url", function () {
                expect(environment.getProjectUrlFromAppUrl("owner/repo")).toEqual("http://owner-repo.local-project.montagestudio.com:2440");
                expect(environment.getProjectUrlFromAppUrl("/owner/repo")).toEqual("http://owner-repo.local-project.montagestudio.com:2440");
                expect(environment.getProjectUrlFromAppUrl("/owner/repo/fail")).toEqual("http://owner-repo.local-project.montagestudio.com:2440");
            });
        });

        describe("getAppHost", function () {
            it("returns a host", function () {
                expect(environment.getAppHost()).toEqual("local-firefly.declarativ.net:2440");
            });
        });

        describe("getProjectHost", function () {
            it("returns a host", function () {
                expect(environment.getProjectHost()).toEqual("local-project.montagestudio.com:2440");
            });
        });

        describe("getProjectPathFromProjectUrl", function () {
            it("returns a path", function () {
                var path = environment.getProjectPathFromProjectUrl("http://owner-repo.local-project.montagestudio.com:2440");

                expect(path.match(/\/owner\/owner\/repo$/)).not.toBeNull();
            });
        });

        describe("getHost", function () {
            it("returns a host", function () {
                expect(getHost("declarativ.com", 2440)).toEqual("declarativ.com:2440");
            });

            it("returns a host with no port", function () {
                expect(getHost("declarativ.com", null)).toEqual("declarativ.com");
            });
        });
    });

});
