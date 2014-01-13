/*global describe,it,expect,waitsFor,runs,__dirname*/

var execNpm = require('../../../package-manager/exec-npm'),
    TIME_OUT = 5000;

describe("npm view command", function () {

    it('should throw an error if the request is not valid.', function() {
        var error = null;

        runs(function() {
            execNpm(execNpm.COMMANDS.VIEW, ["montage@1.0"], __dirname).then(function () {
            }, function (errorThrew) {
                error = errorThrew;
            });
        });

        waitsFor(function() {
            return !!error;
        }, "[Timeout] npm view command ", TIME_OUT);

        runs(function() {
            expect(error.code).toEqual(3001);
        });
    });

    it("should get some information about montage@0.13.0.", function() {
        var module = null;

        runs(function() {
            execNpm(execNpm.COMMANDS.VIEW, ["montage@0.13.0"], __dirname).then(function (moduleRequested) {
                module = moduleRequested;
            });
        });

        waitsFor(function() {
            return !!module;
        }, "[Timeout] npm view command ", TIME_OUT);

        runs(function() {
            expect(typeof module === 'object').toBeDefined();
            expect(module.name).toEqual('montage');
            expect(module.version).toEqual('0.13.0');
        });
    });

});
