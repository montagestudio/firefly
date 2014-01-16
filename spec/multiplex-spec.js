var Multiplex = require("../multiplex");
var selectChain = Multiplex.selectChain;

describe("multiplex", function () {
    describe("selectChain", function () {
        var callbacks,
            appHostname = "local-firefly.declarativ.net",
            appHost = appHostname + ":2440",
            projectHostname = "owner-repo.local-project.127.0.0.1.xip.io",
            projectHost = projectHostname + ":2440";

        beforeEach(function() {
            callbacks = {
                app: function(){},
                project: function(){}
            };
            spyOn(callbacks, "app");
            spyOn(callbacks, "project");
        });

        it("should select the app chain using the hostname", function() {
            var request = {
                hostname: appHostname
            };
            selectChain(request, callbacks.app, callbacks.project);

            expect(callbacks.app).toHaveBeenCalled();
            expect(callbacks.project).not.toHaveBeenCalled();
        });

        it("should select the app chain using the host", function() {
            var request = {
                headers: {host: appHost}
            };
            selectChain(request, callbacks.app, callbacks.project);

            expect(callbacks.app).toHaveBeenCalled();
            expect(callbacks.project).not.toHaveBeenCalled();
        });

        it("should select the project chain using the hostname", function() {
            var request = {
                hostname: projectHostname
            };
            selectChain(request, callbacks.app, callbacks.project);

            expect(callbacks.app).not.toHaveBeenCalled();
            expect(callbacks.project).toHaveBeenCalled();
        });

        it("should select the project chain using the host", function() {
            var request = {
                headers: {host: projectHost}
            };
            selectChain(request, callbacks.app, callbacks.project);

            expect(callbacks.app).not.toHaveBeenCalled();
            expect(callbacks.project).toHaveBeenCalled();
        });
    });
});