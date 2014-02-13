var PreviewService = require("../../../container/services/preview-service");
var environment = new require("../../../environment").Env();

describe("preview-service", function () {
    var service = PreviewService.service();

    function createConnection(host) {
        return {
            req: {headers: {host: host}},
            send: function(content) {},
            close: function() {}
        };
    }

    describe("service", function() {
        it("should create an access code when registering a new preview", function() {
            service.register();

            expect(PreviewService._getPreview().accessCode).toBeDefined();
        });

        it("should unregister a preview", function () {
            service.register();

            service.unregister();
            expect(PreviewService._getPreview().accessCode).not.toBeDefined();
        });

        it("should unregister a preview and close all its connections", function () {
            var url = environment.project.hostname;
            service.register();
            var connection = createConnection(url);
            PreviewService.registerConnection(connection);

            spyOn(connection, "close");

            service.unregister();
            expect(connection.close).toHaveBeenCalled();
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

            it("should issue setObjectProperties", function() {
                var args = {
                    label: "label",
                    ownerModuleId: "ownerModuleId",
                    properties: {property: "value"}
                };
                spyOn(connection1, "send");
                spyOn(connection2, "send");

                service.setObjectProperties(args.label, args.ownerModuleId, args.properties);

                expect(connection1.send).toHaveBeenCalledWith(
                    "setObjectProperties:" + JSON.stringify(args));
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

            expect(PreviewService._getPreview().connections.length).toBe(1);
        });

        it("should unregister a new connection from a preview", function() {
            var connection = createConnection(environment.getProjectHost());

            PreviewService.registerConnection(connection);
            PreviewService.unregisterConnection(connection);

            expect(PreviewService._getPreview().connections.length).toBe(0);
        });
    });

    it("should get the preview access code", function() {
        var accessCode;

        PreviewService._getPreview().accessCode = "leCode";
        accessCode = PreviewService.getPreviewAccessCode();

        expect(accessCode).toBe("leCode");
    });
});
