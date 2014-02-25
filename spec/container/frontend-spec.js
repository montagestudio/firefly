var Q = require("q");
var Frontend = require("../../container/frontend");

describe("Frontend", function () {

    describe("showNotification", function () {
        it("calls showNotification on all frontends", function (done) {
            var connectionA = {invoke: jasmine.createSpy("invokeA") };
            var connectionB = {invoke: jasmine.createSpy("invokeB") };
            return Q.all([
                Frontend.addFrontend("A", connectionA),
                Frontend.addFrontend("B", connectionB)
            ])
            .then(function () {
                return Frontend.showNotification("pass");
            })
            .then(function () {
                expect(connectionA.invoke).toHaveBeenCalled();
                expect(connectionA.invoke.mostRecentCall.args[0]).toEqual("showNotification");
                expect(connectionA.invoke.mostRecentCall.args[1]).toEqual("pass");

                expect(connectionB.invoke).toHaveBeenCalled();
                expect(connectionB.invoke.mostRecentCall.args[0]).toEqual("showNotification");
                expect(connectionB.invoke.mostRecentCall.args[1]).toEqual("pass");
            })
            .finally(function () {
                return Q.all([
                    Frontend.deleteFrontend("A"),
                    Frontend.deleteFrontend("B")
                ]);
            })
            .then(done, done);
        });
    });
});
