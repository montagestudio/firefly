var PreviewService = require("../../services/preview-service");
var environment = new require("../../environment").Env();

describe("preview-service", function () {
    var service = PreviewService.service(),
        previews = PreviewService._previews;

    function createConnection(host) {
        return {
            req: {headers: {host: host}},
            send: function(content) {}
        };
    }

    beforeEach(function () {
        PreviewService.unregisterAllConnections();
    });

    describe("service", function() {
        it("should register a new preview", function () {
            service.register({
                name: "preview",
                url: environment.project.hostname
            });

            expect(previews['local-project']).toBeDefined();
        });

        it("should unregister a preview", function () {
            service.register({
                name: "preview",
                url: environment.project.hostname
            });

            service.unregister(environment.project.hostname);
            expect(previews['local-project']).not.toBeDefined();
        });

        describe("client instrumentation", function() {
            var host, connection1, connection2;

            beforeEach(function() {
                host = environment.getProjectHost();
                connection1 = createConnection(host);
                connection2 = createConnection(host);

                service.register({name: "preview", url: host});
                PreviewService.registerConnection(connection1);
                PreviewService.registerConnection(connection2);
            });

            it("should refresh all preview's clients", function() {
                spyOn(connection1, "send");
                spyOn(connection2, "send");

                service.refresh(host);

                expect(connection1.send).toHaveBeenCalledWith("refresh:");
                expect(connection2.send).toHaveBeenCalledWith("refresh:");
            });
        });
    });

    describe("preview", function() {
        beforeEach(function () {
            service.register({
                name: "preview",
                url: environment.project.hostname
            });
        });

        it("should register a new connection from a preview", function() {
            PreviewService.registerConnection(
                createConnection(environment.getProjectHost()));

            expect(previews['local-project'].connections.length).toBe(1);
        });

        it("should unregister a new connection from a preview", function() {
            var connection = createConnection(environment.getProjectHost());

            PreviewService.registerConnection(connection);
            PreviewService.unregisterConnection(connection);

            expect(previews['local-project'].connections.length).toBe(0);
        });
    });

    it("should generate the preview id from url", function() {
        var url = "http://repo-user.domain.com";
        var previewId = PreviewService.getPreviewIdFromUrl(url);

        expect(previewId).toBe("repo-user");
    });
});
