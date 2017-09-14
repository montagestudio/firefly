var PreviewService = require("../../../container/services/preview-service");
var environment = new require("../../../environment").Env();

describe("preview-service", function () {
    var service = PreviewService.service();

    function createConnection(host) {
        return {
            req: {headers: {host: host}, connection: {}},
            send: function(content) {},
            close: function() {}
        };
    }

    beforeEach(function() {
        var preview = PreviewService._getPreview();

        preview.connections.length = 0;
    });

    describe("service", function() {

        it("should unregister a preview and close all its connections", function () {
            var url = environment.project.hostname;
            service.register();
            var connection = createConnection(url);
            PreviewService.registerConnection(connection, connection.req);

            spyOn(connection, "close");

            service.unregister();
            expect(connection.close).toHaveBeenCalled();
        });

        it("should refresh all preview clients when the preview is registered", function () {
            var url = environment.project.hostname;
            var connection = createConnection(url);
            PreviewService.registerConnection(connection, connection.req);

            spyOn(connection, "send");

            service.register();
            expect(connection.send).toHaveBeenCalledWith("refresh:");
        });

        describe("client instrumentation", function() {
            var host, connection1, connection2;

            beforeEach(function() {
                host = environment.getProjectHost();
                connection1 = createConnection(host);
                connection2 = createConnection(host);

                service.register({name: "preview", url: host});
                PreviewService.registerConnection(connection1, connection1.req);
                PreviewService.registerConnection(connection2, connection2.req);
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

                args.sequenceId = 0;

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
            var connection = createConnection(environment.getProjectHost());
            PreviewService.registerConnection(connection, connection.req);

            expect(PreviewService._getPreview().connections.length).toBe(1);
        });

        it("should unregister a new connection from a preview", function() {
            var connection = createConnection(environment.getProjectHost());

            PreviewService.registerConnection(connection, connection.req);
            PreviewService.unregisterConnection(connection);

            expect(PreviewService._getPreview().connections.length).toBe(0);
        });
    });
});
