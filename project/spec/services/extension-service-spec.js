var ExtensionService = require("../../services/extension-service");
var fs = require("fs");
var PATH = require("path");

describe("extension-service", function () {
    var service;
    beforeEach(function () {
        process.env.FIREFLY_APP_URL = "http://example.com"
        var request = function (url, cb) {
            var requestPath = url.replace("http://firefly_static/", "/");
            var fsPath = PATH.join(__dirname, "..", "fixtures", requestPath.replace(/^\/app\//, "/"));
            var stat = fs.statSync(fsPath);
            var entries, body;
            if (stat.isDirectory()) {
                // Fake a nginx index page
                entries = fs.readdirSync(fsPath);
                body = "<html><body><title>Index of " + requestPath + "</title>";
                body += entries.map(function (entry) {
                    return "\n<a href=\"" + entry + "\">" + entry + "</a>";
                }).join("");
                body += "</body></html>";
            } else {
                body = fs.readFileSync(fsPath).toString("utf-8");
            }
            cb(null, null, body);
        };

        service = ExtensionService(null, null, null, null, request);
    });

    describe("getExtensions", function () {
        it("returns an array of files with the '.filament-extension' extension", function (done) {
            return service.getExtensions()
            .then(function (extensions) {
                expect(extensions.length).toEqual(1);
                expect(extensions[0].url).toEqual("http://example.com/app/extensions/pass.filament-extension");
            })
            .then(done, done);
        });
    });

});
