var environment = require("../environment");

describe("environment", function () {
    describe("getProjectUrl", function () {
        it("returns a url", function () {
            expect(environment.getProjectUrl()).toEqual("http://localhost:2441");
        });
    });
});
