var Promise = require("bluebird");
var preview = require("../../project/preview");
var PreviewDetails = require("../../project/preview-details");

var Set = require("collections/set");

describe("preview", function () {
    describe("hasAccess", function () {
        var previewDetails, githubUser, session;
        beforeEach(function () {
            previewDetails = new PreviewDetails("owner", "owner", "repo");
            githubUser = {login: "owner"};
            session = {
                githubUser: Promise.resolve(githubUser)
            };
        });

        it("should grant access to the logged user to its own previews", function(done) {
            preview.hasAccess(previewDetails, session)
            .then(function (hasAccess) {
                expect(hasAccess).toBe(true);
            }).then(done, done);
        });

        it("should ignore case when granting access to the logged user", function(done) {
            githubUser.login = "Owner";
            preview.hasAccess(previewDetails, session)
            .then(function (hasAccess) {
                expect(hasAccess).toBe(true);
            }).then(done, done);
        });

        it("should grant access when a 3rd party logged in user has access to a private project preview", function(done) {
            githubUser.login = "other";
            session.previewAccess = Set([previewDetails]);
            previewDetails.setPrivate(true);

            preview.hasAccess(previewDetails, session)
            .then(function (hasAccess) {
                expect(hasAccess).toBe(true);
            }).then(done, done);
        });

        it("should grant access when a 3rd party user has access to a private project preview", function(done) {
            delete session.githubUser;
            session.previewAccess = Set([previewDetails]);
            previewDetails.setPrivate(true);

            preview.hasAccess(previewDetails, session)
            .then(function (hasAccess) {
                expect(hasAccess).toBe(true);
            }).then(done, done);
        });

        it("should not grant access when a 3rd party logged in user does not have access", function(done) {
            githubUser.login = "fail";

            preview.hasAccess(previewDetails, session)
            .then(function (hasAccess) {
                expect(hasAccess).toBe(false);
            }).then(done, done);
        });

        it("should grant access when an anonymous 3rd party user tries to access a public project preview", function(done) {
            delete session.githubUser;
            delete session.previewAccess;

            preview.hasAccess(previewDetails, session)
                .then(function (hasAccess) {
                    expect(hasAccess).toBe(true);
                }).then(done, done);
        });

        it("should not grant access when an anonymous 3rd party user has not access to a private project preview", function(done) {
            delete session.githubUser;
            delete session.previewAccess;
            previewDetails.setPrivate(true);

            preview.hasAccess(previewDetails, session)
                .then(function (hasAccess) {
                    expect(hasAccess).toBe(false);
                }).then(done, done);
        });
    });

    describe("processAccessRequest", function() {
        var code, session, request;
        var previewDetails;

        beforeEach(function() {
            previewDetails = new PreviewDetails("owner", "owner", "repo");
            code = preview.getAccessCode(previewDetails);
            session = {
                previewAccess: []
            };

            var host = "1-owner-repo.local-project.montagestudio.com:2440";
            var url = "http://" + host;
            request = {
                url: url,
                headers: {host: host},
                session: session
            };
        });

        it("should grant access with the correct preview access code", function(done) {
            request.body = {read: function(){return Promise.resolve("code=" + code);}};

            return preview.processAccessRequest(request, previewDetails)
            .then(function(response) {
                expect(session.previewAccess.length).toBe(1);
                expect(session.previewAccess[0]).toBe(previewDetails);
            })
            .then(done, done);
        });

        it("should grant access with spaces in the correct preview access code", function(done) {
            code = code.substr(0, 2) + " " + code.substr(2, 3) + "\t" + code.substr(5, 3);
            request.body = {read: function(){return Promise.resolve("code=" + code);}};

            return preview.processAccessRequest(request, previewDetails)
            .then(function(response) {
                expect(session.previewAccess.length).toBe(1);
                expect(session.previewAccess[0]).toBe(previewDetails);
            })
            .then(done, done);
        });

        it("should not grant access with the wrong preview access code", function(done) {
            request.body = {read: function(){return Promise.resolve("code=leWrongCode");}};

            return preview.processAccessRequest(request, previewDetails)
            .then(function(response) {
                expect(session.previewAccess.length).toBe(0);
            })
            .then(done, done);
        });

        it("should redirect to index when access is granted", function(done) {
            request.body = {read: function(){return Promise.resolve("code=" + code);}};

            return preview.processAccessRequest(request, previewDetails)
            .then(function(response) {
                expect(response.headers.Location).toBe("/index.html");
            })
            .then(done, done);
        });

        it("should redirect to index when access is not granted", function(done) {
            request.body = {read: function(){return Promise.resolve("code=leWrongCode");}};

            return preview.processAccessRequest(request, previewDetails)
            .then(function(response) {
                expect(response.headers.Location).toBe("/index.html");
            })
            .then(done, done);
        });
    });

});
