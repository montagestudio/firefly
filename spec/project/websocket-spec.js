var websocket = require("../../project/websocket");

describe("websocket", function () {
    describe("makeServices", function () {
        var services, testServiceFn;
        beforeEach(function () {
            testServiceFn = jasmine.createSpy();
            services = {
                test: testServiceFn
            };
        });

        it("passes in fs", function () {
            var fs = {};
            websocket.makeServices(services, fs);
            expect(testServiceFn.mostRecentCall.args[0]).toBe(fs);
        });

        it("passes in environment", function () {
            var environment = {};
            websocket.makeServices(services, null, environment);
            expect(testServiceFn.mostRecentCall.args[1]).toBe(environment);
        });

        it("passes in pathname", function () {
            var pathname = "pass";
            websocket.makeServices(services, null, null, pathname);
            expect(testServiceFn.mostRecentCall.args[2]).toEqual(pathname);
        });

        it("passes in fsPath", function () {
            var fsPath = "pass";
            websocket.makeServices(services, null, null, null, fsPath);
            expect(testServiceFn.mostRecentCall.args[3]).toEqual(fsPath);
        });

        it("passes in clientPath", function () {
            var clientPath = "pass";
            websocket.makeServices(services, null, null, null, null, clientPath);
            expect(testServiceFn.mostRecentCall.args[4]).toEqual(clientPath);
        });

    });
});
