var FileService = require("../../services/file-service");
var MockFs = require("q-io/fs-mock");
var ADDITIONAL_MIME_TYPES = require("../../detect-mime-type").mimeTypes;

describe("file-service", function () {
    var fs, service;
    beforeEach(function () {
        fs = MockFs({
            "core": {
                "core.js": ""
            },
            "package.json": "{}"
        });

        process.env.FIREFLY_PROJECT_URL = "http://localhost:2441";
        service = FileService({
            subdomain: "/user/owner/repo/"
        }, fs);
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

        it("should replace the content of an existing file with the new content", function (done) {
            return service.writeFile("package.json", dummyStringBase64).then(function() {
                return fs.read("package.json");
            }).then(function(result) {
                expect(result).toBe(dummyString);
            }).then(done, done);
        });
    });

    describe("touch", function () {
        it("should create empty file with the specified name", function (done) {
            return service.touch("some-file").then(function() {
                return fs.isFile("some-file");
            }).then(function(isFile) {
                expect(isFile).toBe(true);
            }).then(done, done);
        });
    });

    describe("makeTreeWriteFile", function () {
        var dummyString = "bla-blah",
            dummyStringBase64 = "YmxhLWJsYWg=";

        it("should create file with the specified name and the sub directories", function (done) {
            return service.makeTreeWriteFile("some-directory/some-file", dummyStringBase64).then(function() {
                return fs.isFile("some-directory/some-file");
            }).then(function(isFile) {
                expect(isFile).toBe(true);
            }).then(done, done);
        });

        it("should create write the expected content to the specified file", function (done) {
            return service.makeTreeWriteFile("some-directory/dummy.txt", dummyStringBase64).then(function() {
                return fs.read("some-directory/dummy.txt");
            }).then(function(result) {
                expect(result).toBe(dummyString);
            }).then(done, done);
        });

        it("should replace the content of an existing file with the new content", function (done) {
            return service.makeTreeWriteFile("package.json", dummyStringBase64).then(function() {
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

                expect(list[0].url).toBe("http://localhost:2441/user/owner/repo/core/");
                expect(list[0].stat).toBeDefined();
                expect(list[1].url).toBe("http://localhost:2441/user/owner/repo/package.json");
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

                expect(list[0].url).toBe("http://localhost:2441/user/owner/repo//");
                expect(list[0].stat).toBeDefined();
                expect(list[1].url).toBe("http://localhost:2441/user/owner/repo/core/");
                expect(list[1].stat).toBeDefined();
                expect(list[2].url).toBe("http://localhost:2441/user/owner/repo/core/core.js");
                expect(list[2].stat).toBeDefined();
                expect(list[3].url).toBe("http://localhost:2441/user/owner/repo/package.json");
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

        it("returns a list of assets with urls and MIME-types", function (done) {
            return fs.reroot(fsPath).then(function (fs) {
                service = FileService({
                    subdomain: "/user/owner/repo/"
                }, fs, null, fsPath);

                return service.listAsset("/").then(function (listAssets) {
                    listAssets.forEach(function (asset) {
                        switch (asset.mimeType) {
                            case ADDITIONAL_MIME_TYPES.MONTAGE_TEMPLATE.value:
                                expect(asset.url).toBe("http://localhost:2441/user/owner/repo/template-test.html");
                                break;
                            case ADDITIONAL_MIME_TYPES.GLTF_BUNDLE.value:
                                expect(asset.url).toBe("http://localhost:2441/user/owner/repo/bundle-test.glTF/");
                                break;
                            case ADDITIONAL_MIME_TYPES.COLLADA.value:
                                expect(asset.url).toBe("http://localhost:2441/user/owner/repo/collada-test.dae");
                                break;
                            case ADDITIONAL_MIME_TYPES.MONTAGE_SERIALIZATION.value:
                                expect(asset.url).toBe("http://localhost:2441/user/owner/repo/serialization-test.json");
                                break;
                        }
                    });
                }).then(done, done);
            });
        });
    });

    describe("makeTree", function () {

        describe("with no part of the desired tree existing", function () {

            it("should create a directory with the specified name when the parent exists and the specified path does not", function (done) {
                return service.makeTree("http://localhost:2441/user/owner/repo/foo")
                    .then(function() {
                        return fs.isDirectory("foo");
                    })
                    .then(function(isDir) {
                        expect(isDir).toBe(true);
                    })
                    .then(done, done);
            });

            it("should create a directory and all parents up to the existing parent root", function (done) {
                return service.makeTree("http://localhost:2441/user/owner/repo/foo/bar/baz")
                    .then(function() {
                        return Promise.all([
                            fs.isDirectory("foo"),
                            fs.isDirectory("foo/bar"),
                            fs.isDirectory("foo/bar/baz")
                        ]);
                    })
                    .then(([isFooDir, isBarDir, isBazDir]) => {
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
                service = FileService({
                    subdomain: "/user/owner/repo/"
                }, fs);
            });

            it("must not replace the specified existing directory", function (done) {
                return service.makeTree("http://localhost:2441/user/owner/repo/foo")
                    .then(function() {
                        return Promise.all([
                            fs.isDirectory("foo"),
                            fs.isDirectory("foo/bar")
                        ]);
                    })
                    .then(([isFooDir, isBarDir]) => {
                        expect(isFooDir).toBe(true);
                        expect(isBarDir).toBe(true);
                    })
                    .then(done, done);
            });

            it("should create directories along the specified path where they do not exist already", function (done) {
                return service.makeTree("http://localhost:2441/user/owner/repo/foo/bar/baz")
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
            service = FileService({
                subdomain: "/user/owner/repo/"
            }, fs);
        });

        it("must fail if the specified file does not exist, with no reference to the file path", function (done) {
            return service.remove("http://localhost:2441/user/owner/repo/foo/qux")
                .catch(function(error) {
                    expect(error.message).toBe("Can't remove non-existant file: http://localhost:2441/user/owner/repo/foo/qux");
                })
                .then(done, done);
        });

        it("should remove the specified file that exists", function (done) {
            return service.remove("http://localhost:2441/user/owner/repo/foo/bar")
                .then(function() {
                    return fs.isFile("foo/bar");
                })
                .then(function(isFile) {
                    expect(isFile).toBe(false);
                })
                .then(done, done);
        });

        it("should resolve to undefined", function (done) {
            return service.remove("http://localhost:2441/user/owner/repo/foo/bar")
                .then(function(success) {
                    expect(success).toBeUndefined();
                })
                .then(done, done);
        });

        it("must not remove the parent directory of the specified file", function (done) {
            return service.remove("http://localhost:2441/user/owner/repo/foo/bar")
                .then(function() {
                    return fs.isDirectory("foo");
                })
                .then(function(isDir) {
                    expect(isDir).toBe(true);
                })
                .then(done, done);
        });

        it("must not remove siblings of the specified file", function (done) {
            return service.remove("http://localhost:2441/user/owner/repo/foo/bar")
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
            service = FileService({
                subdomain: "/user/owner/repo/"
            }, fs);
        });

        it("must fail if the specified directory does not exist, with no reference to the directory path", function (done) {
            return service.removeTree("http://localhost:2441/user/owner/repo/foo/baz")
                .catch(function(error) {
                    expect(error.message).toBe('Can\'t find tree to remove given "http://localhost:2441/user/owner/repo/foo/baz"');
                })
                .then(done, done);
        });

        it("should remove the specified directory that exists", function (done) {
            return service.removeTree("http://localhost:2441/user/owner/repo/foo/bar")
                .then(function() {
                    return Promise.all([
                        fs.isDirectory("foo/bar"),
                        fs.isFile("foo/bar/baz")
                    ]);
                })
                .then(([isBarDir, isBazFile]) => {
                    expect(isBarDir).toBe(false);
                    expect(isBazFile).toBe(false);
                })
                .then(done, done);
        });

        it("should resolve to undefined", function (done) {
            return service.removeTree("http://localhost:2441/user/owner/repo/foo/bar")
                .then(function(success) {
                    expect(success).toBeUndefined();
                })
                .then(done, done);
        });
        it("must not remove the parent directory of the specified directory", function (done) {
            return service.removeTree("http://localhost:2441/user/owner/repo/foo/bar")
                .then(function() {
                    return fs.isDirectory("foo");
                })
                .then(function(isDir) {
                    expect(isDir).toBe(true);
                })
                .then(done, done);
        });

        it("must not remove siblings of the specified file", function (done) {
            return service.removeTree("http://localhost:2441/user/owner/repo/foo/bar")
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
