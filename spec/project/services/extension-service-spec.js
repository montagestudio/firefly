var ExtensionService = require("../../../container/services/extension-service");
var MockFs = require("q-io/fs-mock");
var PATH = require("path");

describe("extension-service", function () {
    var fs, service;
    beforeEach(function () {
        fs = MockFs({
            "core": {
                "core.js": ""
            },
            "package.json": "{}"
        });

        service = ExtensionService(null, null,
            {
                getAppUrl: function () {
                    return "http://example.com";
                }
            },
            null,
            null,
            PATH.join(__dirname, "..", "..", "fixtures")
        );
    });

    describe("getExtensions", function () {
        it("works", function (done) {
            return service.getExtensions()
            .then(function (extensions) {
                expect(extensions.length).toEqual(1);
                expect(extensions[0].url).toEqual("http://example.com/app/extensions/pass.filament-extension");
                expect(extensions[0].stat).toBeDefined();
            })
            .then(done, done);
        });
    });

});
