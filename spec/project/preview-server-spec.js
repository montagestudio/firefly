/*global escape*/
var Q = require("q");
var PreviewServer = require("../../project/preview/preview-server");
var FS = require("q-io/fs");
var htmlparser = require("htmlparser2");

var indexHtml = __dirname + "/../fixtures/preview/index.html";

describe("preview-server", function () {
    beforeEach(function () {

    });

    it("should inject the preview js scripts into the html file", function(done) {
        var request = {
            scheme: "http",
            host: "owner-repo.local-project.montagestudio.com:2440"
        };
        var response = {
            body: Q.resolve({
                read: function() {
                    return FS.read(indexHtml);
                }
            }),
            headers: {}
        };

        PreviewServer.injectPreviewJs(request, response)
        .then(function(response) {
            var found = false;
            var body = response.body[0];
            var parser = new htmlparser.Parser({
                onopentag: function(name, attribs){
                    if(name === "script" && attribs.src === "http://owner-repo.local-project.montagestudio.com:2440/{$PREVIEW}/preview.js"){
                        found = true;
                    }
                }
            });
            parser.write(body);
            parser.end();

            expect(found).toBe(true);
            expect(response.headers['content-length']).toBe(body.length);
        })
        .then(done, done);
    });

    it("should serve the preview js scripts", function(done) {
        var request = {
            path: escape("/{$REFRESH}/preview.js"),
            headers: {}
        };

        PreviewServer.servePreviewClientFile(request)
        .then(function(response) {
            expect(response.file).toBe("preview.js");
        })
        .then(done, done);
    });
});
