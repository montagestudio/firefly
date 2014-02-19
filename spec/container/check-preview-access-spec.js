var Q = require("q");
var CheckPreviewAccess = require("../../container/preview/check-preview-access");
var PreviewService = require("../../container/services/preview-service");

describe("check-preview-access", function () {
    var chain,
        githubUser,
        checkPreviewAccess,
        host = "http://owner-repo.local-project.montagestudio.com:2440",
        request,
        previewService = new PreviewService.service();

    beforeEach(function () {
        githubUser = {login: "owner"};
        request = {
            session: {
                githubUser: Q(githubUser),
                previewAccess: []
            },
            headers: {host: host}
        };

        // Q.bind() in this case will create a function that returns a resolved
        // promise.
        chain = {next: Q.bind()};
        spyOn(chain, "next").andCallThrough();
        checkPreviewAccess = CheckPreviewAccess(chain.next);
    });

    it("should grant access to the logged user to its own previews", function(done) {
        checkPreviewAccess(request)
        .then(function() {
            expect(chain.next).toHaveBeenCalled();
        }).then(done, done);
    });

    it("should ignore case when granting access to the logged user", function(done) {
        githubUser.login = "Owner";
        checkPreviewAccess(request)
        .then(function() {
            expect(chain.next).toHaveBeenCalled();
        }).then(done, done);
    });

    xit("should not grant access when the user doesn't have access and preview isn't registered", function(done) {
        githubUser.login = "user";

        checkPreviewAccess(request)
        .then(function() {
            expect(chain.next).not.toHaveBeenCalled();
        }).then(done, done);
    });

    xit("should not grant access when the user doesn't have access and preview is registered", function(done) {
        previewService.register({name: "", url: host});
        githubUser.login = "user";

        checkPreviewAccess(request)
        .then(function() {
            expect(chain.next).not.toHaveBeenCalled();
        }).then(done, done);
    });

    xit("should not grant access when the user has access and the preview isn't registered", function(done) {
        githubUser.login = "user";
        request.session.previewAccess.push(host);

        checkPreviewAccess(request)
        .then(function() {
            expect(chain.next).not.toHaveBeenCalled();
        }).then(done, done);
    });

    it("should grant access when the user has access and a preview is registered", function(done) {
        previewService.register({name: "", url: host});
        githubUser.login = "user";
        request.session.previewAccess.push(host);

        checkPreviewAccess(request)
        .then(function() {
            expect(chain.next).toHaveBeenCalled();
        }).then(done, done);
    });

    xit("should serve the preview access form when the user isn't granted access", function(done) {
        githubUser.login = "user";

        checkPreviewAccess(request)
        .then(function(response) {
            expect(response.file).toBe("access.html");
        }).then(done, done);
    });
});
