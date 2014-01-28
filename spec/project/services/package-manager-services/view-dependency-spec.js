/*global describe,it,expect,__dirname*/

var execNpm = require('../../../../project/package-manager/exec-npm');

describe("npm view command", function () {

    it('should throw an error if the request is not valid.', function (done) {

        execNpm(execNpm.COMMANDS.VIEW, ["montage@1.0"], __dirname).then(function () {}, function (errorThrew) {
            expect(errorThrew.code).toEqual(3001);

        }).then(done, done);

    });

    it("should get some information about montage@0.13.0.", function (done) {
        execNpm(execNpm.COMMANDS.VIEW, ["montage@0.13.0"], __dirname).then(function (moduleRequested) {
            expect(typeof moduleRequested === 'object').toBeDefined();
            expect(moduleRequested.name).toEqual('montage');
            expect(moduleRequested.version).toEqual('0.13.0');

        }).then(done, done);
    }, 10000);

});
