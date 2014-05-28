var FileService = require("../../../container/services/file-service");
var MockFs = require("q-io/fs-mock");
var ADDITIONAL_MIME_TYPES = require("../../../container/detect-mime-type").mimeTypes;

describe("file-service", function () {
    var fs, service;
    beforeEach(function () {
        fs = MockFs({
            "core": {
                "core.js": ""
            },
            "package.json": "{}"
        });

        service = FileService({}, fs, {
            getProjectUrl: function () {
                return "http://localhost:2441"; // FIXME
            }
        });
    });

    describe("writeFile", function () {
        var dummyString = "bla-blah";
        var dummyStringBase64 = "YmxhLWJsYWg=";

        it("should create file with the specified name", function (done) {
            return service.writeFile("some-file", dummyStringBase64).then(function() {
                return fs.isFile("some-file");
            }).then(function(isFile) {
                expect(isFile).toBe(true);
            }).then(done, done);
        });

        it("should create write the expected content to the specified file", function (done) {
            return service.writeFile("dummy.txt", dummyStringBase64).then(function() {
                return fs.read("dummy.txt");
            }).then(function(result) {
                expect(result).toBe(dummyString);
            }).then(done, done);
        });

        xit("should replace the content of an existing file with the new content", function (done) {
            // q-io/fs-mock is inconsistent with q-io/fs
            // https://github.com/kriskowal/q-io/issues/81
            return service.writeFile("package.json", dummyStringBase64).then(function() {
                return fs.read("package.json");
            }).then(function(result) {
                expect(result).toBe(dummyString);
            }).then(done, done);
        });
    });

    describe("list", function () {
        it("returns an array of {url, stat} of files in the directory", function (done) {
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
        it("returns an array of {url, stat} files in and under the directory", function (done) {
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

    describe("listAsset", function () {
        var fsPath = __dirname + "/assets-tests";

        beforeEach(function () {
            fs = require("q-io/fs");
        });

        if (process.env.runSlowSpecs) {
            it("returns a list of assets with urls and MIME-types", function (done) {
                return fs.reroot(fsPath).then(function (fs) {
                    service = FileService({}, fs, {
                        getProjectUrl: function () {
                            return "http://localhost:2441";
                        }
                    }, null, fsPath);

                    return service.listAsset("/").then(function (listAssets) {
                        listAssets.forEach(function (asset) {
                            switch (asset.mimeType) {
                                case ADDITIONAL_MIME_TYPES.MONTAGE_TEMPLATE.value:
                                    expect(asset.url).toBe("http://localhost:2441/template-test.html");
                                    break;
                                case ADDITIONAL_MIME_TYPES.GLTF_BUNDLE.value:
                                    expect(asset.url).toBe("http://localhost:2441/bundle-test.glTF/");
                                    break;
                                case ADDITIONAL_MIME_TYPES.COLLADA.value:
                                    expect(asset.url).toBe("http://localhost:2441/collada-test.dae");
                                    break;
                                case ADDITIONAL_MIME_TYPES.MONTAGE_SERIALIZATION.value:
                                    expect(asset.url).toBe("http://localhost:2441/serialization-test.json");
                                    break;
                            }
                        });
                    }).then(done, done);
                });
            });
        }
    });

    describe("makeTree", function () {

        describe("with no part of the desired tree existing", function () {

            it("should create a directory with the specified name when the parent exists and the specified path does not", function (done) {
                return service.makeTree("http://localhost:2441/foo")
                    .then(function() {
                        return fs.isDirectory("foo");
                    })
                    .then(function(isDir) {
                        expect(isDir).toBe(true);
                    })
                    .then(done, done);
            });

            it("should create a directory and all parents up to the existing parent root", function (done) {
                return service.makeTree("http://localhost:2441/foo/bar/baz")
                    .then(function() {
                        return [
                            fs.isDirectory("foo"),
                            fs.isDirectory("foo/bar"),
                            fs.isDirectory("foo/bar/baz")
                        ];
                    })
                    .spread(function(isFooDir, isBarDir, isBazDir) {
                        expect(isFooDir).toBe(true);
                        expect(isBarDir).toBe(true);
                        expect(isBazDir).toBe(true);
                    })
                    .then(done, done);
            });
        });

        describe("with parts of the expected tree existing", function () {

            beforeEach(function () {
                fs = MockFs({
                    "foo": {
                        "bar": {}
                    }
                });
                service = FileService({}, fs, {
                    getProjectUrlFromAppUrl: function () {
                        return "http://localhost:2441";
                    }
                });
            });

            it("must not replace the specified existing directory", function (done) {
                return service.makeTree("http://localhost:2441/foo")
                    .then(function() {
                        return [
                            fs.isDirectory("foo"),
                            fs.isDirectory("foo/bar")
                        ];
                    })
                    .spread(function(isFooDir, isBarDir) {
                        expect(isFooDir).toBe(true);
                        expect(isBarDir).toBe(true);
                    })
                    .then(done, done);
            });

            it("should create directories along the specified path where they do not exist already", function (done) {
                return service.makeTree("http://localhost:2441/foo/bar/baz")
                    .then(function() {
                        return fs.isDirectory("foo/bar/baz");
                    })
                    .then(function(isBazDir) {
                        expect(isBazDir).toBe(true);
                    })
                    .then(done, done);
            });
        });

    });

    describe("remove", function () {

        beforeEach(function () {
            fs = MockFs({
                "foo": {
                    "bar": "abc",
                    "baz": "xyz"
                }
            });
            service = FileService({}, fs, {
                getProjectUrlFromAppUrl: function () {
                    return "http://localhost:2441";
                }
            });
        });

        it("must fail if the specified file does not exist, with no reference to the file path", function (done) {
            return service.remove("http://localhost:2441/foo/qux")
                .fail(function(error) {
                    expect(error.message).toBe("Can't remove non-existant file: http://localhost:2441/foo/qux");
                })
                .then(done, done);
        });

        it("should remove the specified file that exists", function (done) {
            return service.remove("http://localhost:2441/foo/bar")
                .then(function() {
                    return fs.isFile("foo/bar");
                })
                .then(function(isFile) {
                    expect(isFile).toBe(false);
                })
                .then(done, done);
        });

        it("should resolve to undefined", function (done) {
            return service.remove("http://localhost:2441/foo/bar")
                .then(function(success) {
                    expect(success).toBeUndefined();
                })
                .then(done, done);
        });

        it("must not remove the parent directory of the specified file", function (done) {
            return service.remove("http://localhost:2441/foo/bar")
                .then(function() {
                    return fs.isDirectory("foo");
                })
                .then(function(isDir) {
                    expect(isDir).toBe(true);
                })
                .then(done, done);
        });

        it("must not remove siblings of the specified file", function (done) {
            return service.remove("http://localhost:2441/foo/bar")
                .then(function() {
                    return fs.isFile("foo/baz");
                })
                .then(function(isFile) {
                    expect(isFile).toBe(true);
                })
                .then(done, done);
        });

    });

    describe("removeTree", function () {

        beforeEach(function () {
            fs = MockFs({
                "foo": {
                    "bar": {
                        "baz": "abc"
                    },
                    "qux": {}
                }
            });
            service = FileService({}, fs, {
                getProjectUrlFromAppUrl: function () {
                    return "http://localhost:2441";
                }
            });
        });

        it("must fail if the specified directory does not exist, with no reference to the directory path", function (done) {
            return service.removeTree("http://localhost:2441/foo/baz")
                .fail(function(error) {
                    expect(error.message).toBe('Can\'t find tree to remove given "http://localhost:2441/foo/baz"');
                })
                .then(done, done);
        });

        it("should remove the specified directory that exists", function (done) {
            return service.removeTree("http://localhost:2441/foo/bar")
                .then(function() {
                    return [
                        fs.isDirectory("foo/bar"),
                        fs.isFile("foo/bar/baz")
                    ];
                })
                .spread(function(isBarDir, isBazFile) {
                    expect(isBarDir).toBe(false);
                    expect(isBazFile).toBe(false);
                })
                .then(done, done);
        });

        it("should resolve to undefined", function (done) {
            return service.removeTree("http://localhost:2441/foo/bar")
                .then(function(success) {
                    expect(success).toBeUndefined();
                })
                .then(done, done);
        });
        it("must not remove the parent directory of the specified directory", function (done) {
            return service.removeTree("http://localhost:2441/foo/bar")
                .then(function() {
                    return fs.isDirectory("foo");
                })
                .then(function(isDir) {
                    expect(isDir).toBe(true);
                })
                .then(done, done);
        });

        it("must not remove siblings of the specified file", function (done) {
            return service.removeTree("http://localhost:2441/foo/bar")
                .then(function() {
                    return fs.isDirectory("foo/qux");
                })
                .then(function(isDir) {
                    expect(isDir).toBe(true);
                })
                .then(done, done);
        });

    });

});
