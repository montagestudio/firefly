var Q = require("q");
var PreviewManager = require("../preview");
var ProjectInfo = require("../project-info");

// var Set = require("collections/set");

// TODO: Restore 3rd-party specs
describe("preview", function () {
    var previewManager;

    beforeEach(function () {
        previewManager = new PreviewManager();
    });

    describe("hasAccess", function () {
        var request, projectInfo;
        beforeEach(function () {
            projectInfo = new ProjectInfo("owner", "owner", "repo");
            request = {
                githubUser: { login: "owner" }
            };
        });

        it("should grant access to the logged user to its own previews", function(done) {
            previewManager.hasAccess(request, projectInfo)
            .then(function (hasAccess) {
                expect(hasAccess).toBe(true);
            }).then(done, done);
        });

        it("should ignore case when granting access to the logged user", function(done) {
            request.githubUser.login = "Owner";
            previewManager.hasAccess(request, projectInfo)
            .then(function (hasAccess) {
                expect(hasAccess).toBe(true);
            }).then(done, done);
        });

        xit("should grant access when a 3rd party logged in user has access to a private project preview", function(done) {
            request.githubUser.login = "other";
            // session.previewAccess = Set([projectInfo]);
            projectInfo.setPrivate(true);

            previewManager.hasAccess(request, projectInfo)
            .then(function (hasAccess) {
                expect(hasAccess).toBe(true);
            }).then(done, done);
        });

        xit("should grant access when a 3rd party user has access to a private project preview", function(done) {
            delete request.githubUser;
            // session.previewAccess = Set([projectInfo]);
            projectInfo.setPrivate(true);

            previewManager.hasAccess(request, projectInfo)
            .then(function (hasAccess) {
                expect(hasAccess).toBe(true);
            }).then(done, done);
        });

        xit("should not grant access when a 3rd party logged in user does not have access", function(done) {
            request.githubUser.login = "fail";

            previewManager.hasAccess(request, projectInfo)
            .then(function (hasAccess) {
                expect(hasAccess).toBe(false);
            }).then(done, done);
        });

        xit("should grant access when an anonymous 3rd party user tries to access a public project preview", function(done) {
            delete request.githubUser;
            // delete session.previewAccess;

            previewManager.hasAccess(request, projectInfo)
                .then(function (hasAccess) {
                    expect(hasAccess).toBe(true);
                }).then(done, done);
        });

        xit("should not grant access when an anonymous 3rd party user has not access to a private project preview", function(done) {
            delete request.githubUser;
            // delete session.previewAccess;
            projectInfo.setPrivate(true);

            previewManager.hasAccess(request, projectInfo)
                .then(function (hasAccess) {
                    expect(hasAccess).toBe(false);
                }).then(done, done);
        });
    });

    xdescribe("processAccessRequest", function() {
        var code, session, request;
        var projectInfo;

        beforeEach(function() {
            projectInfo = new ProjectInfo("owner", "owner", "repo");
            code = previewManager.getAccessCode(projectInfo);

            var host = "project.local.montage.studio:2440";
            var url = "http://" + host;
            request = {
                url: url,
                headers: {host: host}
            };
        });

        it("should grant access with the correct preview access code", function(done) {
            request.body = {read: function(){return Q.resolve("code=" + code);}};

            return previewManager.processAccessRequest(request, projectInfo)
            .then(function(response) {
                expect(session.previewAccess.length).toBe(1);
                expect(session.previewAccess[0]).toBe(projectInfo);
            })
            .then(done, done);
        });

        it("should grant access with spaces in the correct preview access code", function(done) {
            code = code.substr(0, 2) + " " + code.substr(2, 3) + "\t" + code.substr(5, 3);
            request.body = {read: function(){return Q.resolve("code=" + code);}};

            return previewManager.processAccessRequest(request, projectInfo)
            .then(function(response) {
                expect(session.previewAccess.length).toBe(1);
                expect(session.previewAccess[0]).toBe(projectInfo);
            })
            .then(done, done);
        });

        it("should not grant access with the wrong preview access code", function(done) {
            request.body = {read: function(){return Q.resolve("code=leWrongCode");}};

            return previewManager.processAccessRequest(request, projectInfo)
            .then(function(response) {
                expect(session.previewAccess.length).toBe(0);
            })
            .then(done, done);
        });

        it("should redirect to index when access is granted", function(done) {
            request.body = {read: function(){return Q.resolve("code=" + code);}};

            return previewManager.processAccessRequest(request, projectInfo)
            .then(function(response) {
                expect(response.headers.Location).toBe("/index.html");
            })
            .then(done, done);
        });

        it("should redirect to index when access is not granted", function(done) {
            request.body = {read: function(){return Q.resolve("code=leWrongCode");}};

            return previewManager.processAccessRequest(request, projectInfo)
            .then(function(response) {
                expect(response.headers.Location).toBe("/index.html");
            })
            .then(done, done);
        });
    });

});
