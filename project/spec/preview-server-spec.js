/*global escape*/
var Q = require("q");
var PreviewServer = require("../preview/preview-server");
var FS = require("q-io/fs");
var htmlparser = require("htmlparser2");

var indexHtml = __dirname + "/fixtures/preview/index.html";

describe("preview-server", function () {

    it("should inject the preview scripts into the html file", function(done) {
        var request = {
            scheme: "http",
            host: "local-project.montagestudio.com:2440",
            pathname: "/1-owner-repo"
        };
        var response = {
            body: Q.resolve({
                read: function() {
                    return FS.read(indexHtml);
                }
            }),
            headers: {}
        };

        PreviewServer.injectPreviewScripts(request, response, "1-owner-repo")
        .then(function(response) {
            var foundPreview = false;
            var foundLiveEdit = false;
            var body = response.body[0];
            var parser = new htmlparser.Parser({
                onopentag: function(name, attribs){
                    if (name === "script") {
                        if (attribs.src === "/1-owner-repo/{$PREVIEW}/preview.js") {
                            foundPreview = true;
                        }
                        if (attribs.src === "/1-owner-repo/{$PREVIEW}/live-edit.js") {
                            foundLiveEdit = true;
                        }
                    }
                }
            });
            parser.write(body);
            parser.end();

            expect(foundPreview).toBe(true);
            expect(foundLiveEdit).toBe(true);
            expect(response.headers['content-length']).toBe(body.length);
        })
        .then(done, done);
    });

    it("should serve the preview js scripts", function(done) {
        var request = {
            pathInfo: escape("/{$PREVIEW}/preview.js"),
            headers: {}
        };

        PreviewServer.servePreviewClientFile(request)
        .then(function(response) {
            expect(response.file).toBe("preview.js");
        })
        .then(done, done);
    });
});
