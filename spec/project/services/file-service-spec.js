var FileService = require("../../../project/services/file-service");
var MockFs = require("q-io/fs-mock");

describe("file-service", function () {
    var fs, service;
    beforeEach(function () {
        fs = MockFs({
            "core": {
                "core.js": ""
            },
            "package.json": "{}"
        });

        service = FileService(fs, {
            getProjectUrlFromAppUrl: function () {
                return "http://localhost:2441";
            }
        });
    });

    describe("list", function () {
        it("works", function (done) {
            return service.list("/")
            .then(function (list) {
                expect(list.length).toEqual(2);

                expect(list[0].url).toBe("http://localhost:2441/core/");
                expect(list[0].stat).toBeDefined();
                expect(list[1].url).toBe("http://localhost:2441/package.json");
                expect(list[1].stat).toBeDefined();
            })
            .then(done, done);
        });
    });

    describe("listTree", function () {
        it("works", function (done) {
            return service.listTree("/")
            .then(function (list) {
                expect(list.length).toEqual(4);

                expect(list[0].url).toBe("http://localhost:2441//");
                expect(list[0].stat).toBeDefined();
                expect(list[1].url).toBe("http://localhost:2441/core/");
                expect(list[1].stat).toBeDefined();
                expect(list[2].url).toBe("http://localhost:2441/core/core.js");
                expect(list[2].stat).toBeDefined();
                expect(list[3].url).toBe("http://localhost:2441/package.json");
                expect(list[3].stat).toBeDefined();
            })
            .then(done, done);
        });
    });

});
