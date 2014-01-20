var Q = require("q");
var CheckPreviewAccess = require("../preview/check-preview-access");

describe("check-preview-access", function () {
    var chain,
        checkPreviewAccess,
        host = "http://owner-repo.local-project.127.0.0.1.xip.io:2440",
        request;

    beforeEach(function () {
        request = {
            session: {
                githubUser: {login: "owner"},
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

    it("should not grant access when the user doesn't have access", function(done) {
        request.session.githubUser.login = "user";

        checkPreviewAccess(request)
        .then(function() {
            expect(chain.next).not.toHaveBeenCalled();
        }).then(done, done);
    });

    it("should grant access when the user has access", function(done) {
        request.session.githubUser.login = "user";
        request.session.previewAccess.push(host);

        checkPreviewAccess(request)
        .then(function() {
            expect(chain.next).toHaveBeenCalled();
        }).then(done, done);
    });

    it("should serve the preview access form when the user isn't granted access", function(done) {
        request.session.githubUser.login = "user";

        checkPreviewAccess(request)
        .then(function(response) {
            expect(response.file).toBe("access.html");
        }).then(done, done);
    });
});