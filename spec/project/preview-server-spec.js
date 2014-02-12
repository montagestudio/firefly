/*global escape*/
var Q = require("q");
var PreviewServer = require("../../project/preview/preview-server");
var FS = require("q-io/fs");
var htmlparser = require("htmlparser2");
var PreviewService = require("../../project/services/preview-service");

var indexHtml = __dirname + "/../fixtures/preview/index.html";

describe("preview-server", function () {
    beforeEach(function () {
        PreviewService.unregisterAllConnections();
    });

    it("should inject the preview scripts into the html file", function(done) {
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

        PreviewServer.injectPreviewScripts(request, response)
        .then(function(response) {
            var foundPreview = false;
            var foundLiveEdit = false;
            var body = response.body[0];
            var parser = new htmlparser.Parser({
                onopentag: function(name, attribs){
                    if (name === "script") {
                        if (attribs.src === "/{$PREVIEW}/preview.js") {
                            foundPreview = true;
                        }
                        if (attribs.src === "/{$PREVIEW}/live-edit.js") {
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
            path: escape("/{$REFRESH}/preview.js"),
            headers: {}
        };

        PreviewServer.servePreviewClientFile(request)
        .then(function(response) {
            expect(response.file).toBe("preview.js");
        })
        .then(done, done);
    });

    describe("processAccessRequest", function() {
        var host = "owner-repo.local-project.montagestudio.com:2440";
        var url = "http://" + host;
        var session, request;

        beforeEach(function() {
            session = {
                previewAccess: []
            };
            request = {
                url: url,
                headers: {host: host},
                session: session
            };
            PreviewService._previews["owner-repo"] = {
                accessCode: "leCode"
            };
        });

        it("should grant access with the correct preview access code", function(done) {
            request.body = {read: function(){return Q.resolve("code=leCode");}};

            return PreviewServer.processAccessRequest(request)
            .then(function(response) {
                expect(session.previewAccess.length).toBe(1);
                expect(session.previewAccess[0]).toBe(host);
            })
            .then(done, done);
        });

        it("should not grant access with the wrong preview access code", function(done) {
            request.body = {read: function(){return Q.resolve("code=leWrongCode");}};

            return PreviewServer.processAccessRequest(request)
            .then(function(response) {
                expect(session.previewAccess.length).toBe(0);
            })
            .then(done, done);
        });

        it("should redirect to index when access is granted", function(done) {
            request.body = {read: function(){return Q.resolve("code=leCode");}};

            return PreviewServer.processAccessRequest(request)
            .then(function(response) {
                expect(response.headers.Location).toBe("/index.html");
            })
            .then(done, done);
        });

        it("should redirect to index when access is not granted", function(done) {
            request.body = {read: function(){return Q.resolve("code=leWrongCode");}};

            return PreviewServer.processAccessRequest(request)
            .then(function(response) {
                expect(response.headers.Location).toBe("/index.html");
            })
            .then(done, done);
        });
    });
});
