var Env = require("../environment").Env;
var getHost = require("../environment").getHost;

describe("environment", function () {
    var environment;
    describe("in developement", function () {
        beforeEach(function () {
            environment = Env();
        });

        describe("getAppUrl", function () {
            it("returns a url", function () {
                expect(environment.getAppUrl()).toEqual("http://local-firefly.declarativ.net:2440");
            });
        });

        describe("getProjectUrl", function () {
            it("returns a url", function () {
                expect(environment.getProjectUrl("pass")).toEqual("http://pass.local-project.montagestudio.com:2440");
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
