var RemovePackage = require("../../../../project/package-manager/remove-package"),
    ProjectFSMocks = require("../../../mocks/project-fs-sample"),
    ErrorsCodes = RemovePackage.ERRORS;

describe("remove command", function () {
    var mockFS;

    beforeEach(function () {
        mockFS = ProjectFSMocks();
    });

    it('should remove a specified dependency.', function (done) {

        RemovePackage(mockFS, 'montage', '/').then(function (module) {
            expect(typeof module).toEqual("object");
            expect(module.name).toEqual("montage");

        }).then(done, done);

    });

    it('should throw an error when the dependency name is not a valid string.', function (done) {

        RemovePackage(mockFS, 42, '/').then(null, function (error) {
            expect(error.code).toEqual(ErrorsCodes.DEPENDENCY_NAME_NOT_VALID);

        }).then(done, done);

    });

    it('should throw an error it does not find a package', function (done) {

        RemovePackage(mockFS, 'montage', '/42').then(null, function (error) {
            expect(error.code).toEqual(ErrorsCodes.DEPENDENCY_NOT_FOUND);

        }).then(done, done);

    });

});
