var Q = require("q");
var preview = require("../../project/preview.js");

describe("preview", function () {
    describe("hasAccess", function () {
        var url, githubUser, session;
        beforeEach(function () {
            url = "http://owner-repo.local-project.montagestudio.com:2440";
            githubUser = {login: "owner"};
            session = {
                githubUser: Q(githubUser),
                previewAccess: []
            };
        });

        it("should grant access to the logged user to its own previews", function(done) {
            preview.hasAccess(url, session)
            .then(function (hasAccess) {
                expect(hasAccess).toBe(true);
            }).then(done, done);
        });

        it("should ignore case when granting access to the logged user", function(done) {
            githubUser.login = "Owner";
            preview.hasAccess(url, session)
            .then(function (hasAccess) {
                expect(hasAccess).toBe(true);
            }).then(done, done);
        });

        it("should grant access when a 3rd party logged in user has access", function(done) {
            githubUser.login = "other";
            session.previewAccess.push(url);

            preview.hasAccess(url, session)
            .then(function (hasAccess) {
                expect(hasAccess).toBe(true);
            }).then(done, done);
        });

        it("should grant access when a 3rd party user has access", function(done) {
            delete session.githubUser;
            session.previewAccess.push(url);

            preview.hasAccess(url, session)
            .then(function (hasAccess) {
                expect(hasAccess).toBe(true);
            }).then(done, done);
        });

        it("should not grant access when a 3rd party logged in user does not have access", function(done) {
            githubUser.login = "fail";

            preview.hasAccess(url, session)
            .then(function (hasAccess) {
                expect(hasAccess).toBe(false);
            }).then(done, done);
        });

        it("should not grant access when a 3rd party user does not have access", function(done) {
            delete session.githubUser;
            delete session.previewAccess;

            preview.hasAccess(url, session)
            .then(function (hasAccess) {
                expect(hasAccess).toBe(false);
            }).then(done, done);
        });
    });

    describe("processAccessRequest", function() {
        var host = "owner-repo.local-project.montagestudio.com:2440";
        var url = "http://" + host;
        var code, session, request;

        beforeEach(function() {
            code = preview.getAccessCode(host);
            session = {
                previewAccess: []
            };
            request = {
                url: url,
                headers: {host: host},
                session: session
            };
        });

        it("should grant access with the correct preview access code", function(done) {
            request.body = {read: function(){return Q.resolve("code=" + code);}};

            return preview.processAccessRequest(request)
            .then(function(response) {
                expect(session.previewAccess.length).toBe(1);
                expect(session.previewAccess[0]).toBe(host);
            })
            .then(done, done);
        });

        it("should not grant access with the wrong preview access code", function(done) {
            request.body = {read: function(){return Q.resolve("code=leWrongCode");}};

            return preview.processAccessRequest(request)
            .then(function(response) {
                expect(session.previewAccess.length).toBe(0);
            })
            .then(done, done);
        });

        it("should redirect to index when access is granted", function(done) {
            request.body = {read: function(){return Q.resolve("code=" + code);}};

            return preview.processAccessRequest(request)
            .then(function(response) {
                expect(response.headers.Location).toBe("/index.html");
            })
            .then(done, done);
        });

        it("should redirect to index when access is not granted", function(done) {
            request.body = {read: function(){return Q.resolve("code=leWrongCode");}};

            return preview.processAccessRequest(request)
            .then(function(response) {
                expect(response.headers.Location).toBe("/index.html");
            })
            .then(done, done);
        });
    });

});
