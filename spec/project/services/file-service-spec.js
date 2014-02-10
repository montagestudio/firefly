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

    describe("writeFile", function () {
        var dummyString = "bla-blah";
        var dummyStringBase64 = "YmxhLWJsYWg=";

        it("should create file with the specified name", function (done) {
            return service.writeFile("some-file", dummyStringBase64).then(function() {
                fs.isFile("some-file").then(function(isFile) {
                    expect(isFile).toBe(true);
                });
            }).then(done, done);
        });

        it("should create write the expected content to the specified file", function (done) {
            return service.writeFile("dummy.txt", dummyStringBase64).then(function() {
                fs.read("dummy.txt").then(function(result) {
                    expect(result).toBe(dummyString);
                });
            }).then(done, done);
        });

        xit("should replace the content of an existing file with the new content", function (done) {
            // q-io/fs-mock is inconsistent with q-io/fs
            return service.writeFile("package.json", dummyStringBase64).then(function() {
                fs.read("package.json").then(function(result) {
                    expect(result).toBe(dummyString);
                });
            }).then(done, done);
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
