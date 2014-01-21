var Q = require("q");
var PreviewService = require("../../../project/services/preview-service");
var environment = new require("../../../environment").Env();

describe("preview-service", function () {
    var service = PreviewService.service(),
        previews = PreviewService._previews;

    function createConnection(host) {
        return {
            req: {headers: {host: host}},
            send: function(content) {},
            close: function() {}
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

        it("should create an access code when registering a new preview", function() {
            service.register({
                name: "preview",
                url: environment.project.hostname
            });

            expect(previews['local-project'].accessCode).toBeDefined();
        });

        it("should unregister a preview", function () {
            service.register({
                name: "preview",
                url: environment.project.hostname
            });

            service.unregister(environment.project.hostname);
            expect(previews['local-project']).not.toBeDefined();
        });

        it("should unregister a preview and close all its connections", function () {
            var url = environment.project.hostname;
            service.register({
                name: "preview",
                url: url
            });
            var connection = createConnection(url);
            PreviewService.registerConnection(connection);

            spyOn(connection, "close");

            service.unregister(url);
            expect(connection.close).toHaveBeenCalled();
        });

        it("should know if a preview exists by url", function() {
            var url = environment.project.hostname;

            service.register({
                name: "preview",
                url: url
            });

            expect(PreviewService.existsPreviewFromUrl(url)).toBe(true);
        });

        it("should know if a preview does not exist by url", function() {
            var url = environment.project.hostname;

            expect(PreviewService.existsPreviewFromUrl(url)).toBe(false);
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

            it("should refresh all preview's clients on http", function() {
                var deferred1 = {resolve: function() {}};
                var deferred2 = {resolve: function() {}};
                var expectedResponse = {
                    status: 200,
                    headers: {
                        'content-type': 'text/plain'
                    },
                    body: ['refresh:']
                };

                spyOn(deferred1, "resolve");
                spyOn(deferred2, "resolve");
                spyOn(global, "setInterval");
                PreviewService.registerDeferredResponse(host, deferred1);
                PreviewService.registerDeferredResponse(host, deferred2);

                service.refresh(host);

                expect(deferred1.resolve).toHaveBeenCalledWith(expectedResponse);
                expect(deferred2.resolve).toHaveBeenCalledWith(expectedResponse);
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

        it("should register a new deferred response from a preview", function() {
            var deferred = Q.defer();

            spyOn(global, "setInterval");
            PreviewService.registerDeferredResponse(
                environment.getProjectHost(), deferred);

            expect(previews['local-project'].requests.length).toBe(1);
        });
    });

    it("should generate the preview id from url", function() {
        var url = "http://repo-user.domain.com";
        var previewId = PreviewService.getPreviewIdFromUrl(url);

        expect(previewId).toBe("repo-user");
    });

    it("should get the preview access code from a url", function() {
        var url = "http://repo-user.domain.com",
            accessCode;

        previews["repo-user"] = {
            accessCode: "leCode"
        };
        accessCode = PreviewService.getPreviewAccessCodeFromUrl(url);

        expect(accessCode).toBe("leCode");
    });
});
