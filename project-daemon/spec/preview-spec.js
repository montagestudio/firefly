const Q = require("q");
const PreviewManager = require("../preview");
const ProjectInfo = require("../project-info");

// const Set = require("collections/set");

const asyncTest = (test) => (done) =>
    Promise.resolve(test()).then(done).catch(done);

// TODO: Restore 3rd-party specs
describe("preview", () => {
    let previewManager;

    beforeEach(() => {
        previewManager = new PreviewManager();
    });

    describe("hasAccess", () => {
        let request, projectInfo;
        beforeEach(() => {
            projectInfo = new ProjectInfo("owner", "owner", "repo");
            request = {
                githubUser: { login: "owner" }
            };
        });

        it("should grant access to the logged user to its own previews", asyncTest(async () => {
            const hasAccess = await previewManager.hasAccess(request, projectInfo);
            expect(hasAccess).toBe(true);
        }));

        it("should ignore case when granting access to the logged user", asyncTest(async () => {
            request.githubUser.login = "Owner";
            const hasAccess = previewManager.hasAccess(request, projectInfo);
            expect(hasAccess).toBe(true);
        }));

        xit("should grant access when a 3rd party logged in user has access to a private project preview", asyncTest(async () => {
            request.githubUser.login = "other";
            // session.previewAccess = Set([projectInfo]);
            projectInfo.setPrivate(true);

            const hasAccess = previewManager.hasAccess(request, projectInfo);
            expect(hasAccess).toBe(true);
        }));

        xit("should grant access when a 3rd party user has access to a private project preview", asyncTest(async () => {
            delete request.githubUser;
            // session.previewAccess = Set([projectInfo]);
            projectInfo.setPrivate(true);

            const hasAccess = await previewManager.hasAccess(request, projectInfo);
            expect(hasAccess).toBe(true);
        }));

        xit("should not grant access when a 3rd party logged in user does not have access", asyncTest(async () => {
            request.githubUser.login = "fail";

            const hasAccess = await previewManager.hasAccess(request, projectInfo);
            expect(hasAccess).toBe(false);
        }));

        xit("should grant access when an anonymous 3rd party user tries to access a public project preview", asyncTest(async () => {
            delete request.githubUser;
            // delete session.previewAccess;

            const hasAccess = await previewManager.hasAccess(request, projectInfo);
            expect(hasAccess).toBe(true);
        }));

        xit("should not grant access when an anonymous 3rd party user has not access to a private project preview", asyncTest(async () => {
            delete request.githubUser;
            // delete session.previewAccess;
            projectInfo.setPrivate(true);

            const hasAccess = await previewManager.hasAccess(request, projectInfo);
            expect(hasAccess).toBe(false);
        }));
    });

    xdescribe("processAccessRequest", function() {
        let code, session, request, projectInfo;

        beforeEach(() => {
            projectInfo = new ProjectInfo("owner", "owner", "repo");
            code = previewManager.getAccessCode(projectInfo);

            const host = "project.local.montage.studio:2440";
            const url = "http://" + host;
            request = {
                url: url,
                headers: {host: host}
            };
        });

        it("should grant access with the correct preview access code", asyncTest(async () => {
            request.body = { read: async () => `code=${code}` };

            await previewManager.processAccessRequest(request, projectInfo);
            expect(session.previewAccess.length).toBe(1);
            expect(session.previewAccess[0]).toBe(projectInfo);
        }));

        it("should grant access with spaces in the correct preview access code", asyncTest(async () => {
            code = code.substr(0, 2) + " " + code.substr(2, 3) + "\t" + code.substr(5, 3);
            request.body = {read: function(){return Q.resolve("code=" + code);}};

            await previewManager.processAccessRequest(request, projectInfo);
            expect(session.previewAccess.length).toBe(1);
            expect(session.previewAccess[0]).toBe(projectInfo);
        }));

        it("should not grant access with the wrong preview access code", asyncTest(async () => {
            request.body = {read: function(){return Q.resolve("code=leWrongCode");}};

            await previewManager.processAccessRequest(request, projectInfo);
            expect(session.previewAccess.length).toBe(0);
        }));

        it("should redirect to index when access is granted", asyncTest(async () => {
            request.body = {read: function(){return Q.resolve("code=" + code);}};

            const response = await previewManager.processAccessRequest(request, projectInfo);
            expect(response.headers.Location).toBe("/index.html");
        }));

        it("should redirect to index when access is not granted", asyncTest(async () => {
            request.body = { read: async () => "code=leWrongCode" };

            const response = await previewManager.processAccessRequest(request, projectInfo)
            expect(response.headers.Location).toBe("/index.html");
        }));
    });

});
