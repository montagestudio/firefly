/*global describe,it,expect*/

var DEPENDENCY_CATEGORIES = require("../../../../project/package-manager/dependency-node").DEPENDENCY_CATEGORIES,
    ErrorsCodes = require("../../../../project/package-manager/detect-error-dependency-tree").ERROR_TYPES,
    PackageManagerService = require("../../../../project/services/package-manager-service"),
    ProjectFSMocksFactory = require('../../../mocks/project-fs-factory'),
    ProjectFSMocks = require("../../../mocks/project-fs-sample"),
    QFSMock = require("q-io/fs-mock"),
    DEFAULT_PROJECT_APP = 'my-project-sample';

/*
 * Some specs for the listDependencies function,
 * uses a fake project fs which can be found here: mocks/project-fs-sample
 */

describe("list dependencies", function () {
    var mockFS, service, nodesPosition;

    function _runListDependencies () {
        return service.listDependenciesAtUrl('/').then(function _handleListDependencies (tree) {
            nodesPosition = {};

            var children = tree.children,
                childrenKeys = Object.keys(children);

            childrenKeys.forEach(function (childrenKey) {
                var childrenCategory = children[childrenKey];

                for (var i = 0, length = childrenCategory.length; i < length; i++) {
                    var dependencyNode = childrenCategory[i];
                    nodesPosition[dependencyNode.name] = i;
                }
            });

            return tree;
        });
    }

    describe("no errors situation", function () {

        beforeEach(function () {
            mockFS = ProjectFSMocks(DEFAULT_PROJECT_APP);
            service = PackageManagerService(null, mockFS);
        });

        it('should gather some correct information about the project.', function (done) {

            _runListDependencies().then(function (dependencyTree) {
                expect(typeof dependencyTree).toEqual("object");
                expect(dependencyTree.name).toEqual(DEFAULT_PROJECT_APP);
                expect(dependencyTree.version).toEqual('0.1.0');
                expect(dependencyTree.fileJsonRaw).toBeDefined();
                expect(dependencyTree.children.regular.length).toBeGreaterThan(0);
                expect(dependencyTree.children.dev.length).toBeGreaterThan(0);
                expect(dependencyTree.children.optional.length).toBeGreaterThan(0);
                expect(dependencyTree.bundled.length).toBeGreaterThan(0);

            }).then(done, done);

        });


        it('should detect when an ancestor is used by a deeper dependency.', function (done) {

            _runListDependencies().then(function (dependencyTree) {

                /*
                 * Within the sample the module Montage has a dependency Joey which needs the module Q.
                 * This module should be a reference to the module Q that can be found within the optional Dependencies.
                 */
                var montageNode = dependencyTree.children.regular[nodesPosition.montage];
                expect(montageNode.problems).not.toBeDefined();

            }).then(done, done);

        });

        it('should has no errors in this situation.', function (done) {

            _runListDependencies().then(function (dependencyTree) {
                var children = dependencyTree.children,
                    childrenKeys = Object.keys(children);

                childrenKeys.forEach(function (childrenKey) {
                    var childrenCategory = children[childrenKey];

                    for (var i = 0, length = childrenCategory.length; i < length; i++) {
                        expect(childrenCategory[i].problems).not.toBeDefined();
                    }
                });

            }).then(done, done);

        });

        it('a dependency is not extraneous if it belongs to the "bundledDependencies" field.', function (done) {

            _runListDependencies().then(function (dependencyTree) {
                var zipNode = dependencyTree.children.regular[nodesPosition.zip];
                expect(zipNode.problems).not.toBeDefined();
                expect(dependencyTree.bundled[2]).toEqual(zipNode.name);

            }).then(done, done);

        });

        it('a dependency is not missing if it belongs to the "devDependencies" or the "optionalDependencies" field.', function (done) {

            _runListDependencies().then(function (dependencyTree) {
                var sipNode = dependencyTree.children.optional[nodesPosition.sip];
                expect(sipNode.problems).not.toBeDefined();
                expect(sipNode.type).toEqual(DEPENDENCY_CATEGORIES.OPTIONAL);

                var underscoreNode = dependencyTree.children.dev[nodesPosition.underscore];
                expect(underscoreNode.problems).not.toBeDefined();
                expect(underscoreNode.type).toEqual(DEPENDENCY_CATEGORIES.DEV);

            }).then(done, done);

        });

    });

    describe("errors situation:", function () {

        beforeEach(function () {
            mockFS = ProjectFSMocks(DEFAULT_PROJECT_APP, true); // FS Project Sample with Errors
            service = PackageManagerService(null, mockFS);
        });

        it('should detect when a regular dependency is missing.', function (done) {

            _runListDependencies().then(function (dependencyTree) {
                var digitNode = dependencyTree.children.regular[nodesPosition.digit];

                expect(digitNode.missing).toEqual(true);
                expect(digitNode.type).toEqual(DEPENDENCY_CATEGORIES.REGULAR);
                expect(digitNode.problems).toBeDefined();
                expect(digitNode.problems[0].errorType).toEqual(ErrorsCodes.DEPENDENCY_MISSING);
                expect(dependencyTree.children.regular[nodesPosition.filament].missing).toEqual(false);

            }).then(done, done);

        });

        it('should detect an extraneous dependency.', function(done) {

            _runListDependencies().then(function (dependencyTree) {
                var filamentNode = dependencyTree.children.regular[nodesPosition.filament];

                expect(filamentNode.extraneous).toEqual(true);
                expect(filamentNode.problems).toBeDefined();
                expect(filamentNode.problems[0].errorType).toEqual(ErrorsCodes.DEPENDENCY_EXTRANEOUS);

            }).then(done, done);

        });

        it('should detect an invalid regular or optional dependency version.', function (done) {

            _runListDependencies().then(function (dependencyTree) {
                var montageNode = dependencyTree.children.regular[nodesPosition.montage];
                expect(montageNode.type).toEqual(DEPENDENCY_CATEGORIES.REGULAR);
                expect(montageNode.problems).toBeDefined();
                expect(montageNode.problems[0].errorType).toEqual(ErrorsCodes.VERSION_INVALID);

                var montageTestingNode = dependencyTree.children.optional[nodesPosition["montage-testing"]];
                expect(montageTestingNode.type).toEqual(DEPENDENCY_CATEGORIES.OPTIONAL);
                expect(montageTestingNode.problems).toBeDefined();
                expect(montageTestingNode.problems[0].errorType).toEqual(ErrorsCodes.VERSION_INVALID);

                var nativeNode = dependencyTree.children.dev[nodesPosition.native];
                expect(nativeNode.type).toEqual(DEPENDENCY_CATEGORIES.DEV);
                expect(nativeNode.problems).not.toBeDefined();

            }).then(done, done);

        });

        it('should detect an invalid ancestor which its used by a deeper dependency.', function (done) {

            _runListDependencies().then(function (dependencyTree) {
                var montageNode = dependencyTree.children.regular[nodesPosition.montage];

                expect(montageNode.problems).toBeDefined();
                expect(montageNode.problems[1].errorType).toEqual(ErrorsCodes.DEPENDENCY_MISSING);

                // the module joey needs a valid version of the package named zip.
                expect(montageNode.problems[2].errorType).toEqual(ErrorsCodes.VERSION_INVALID);

            }).then(done, done);

        });

        it('should detect when a package.json file is missing.', function (done) {

            _runListDependencies().then(function (dependencyTree) {
                var zyNode = dependencyTree.children.regular[nodesPosition.zy];

                expect(zyNode.problems).toBeDefined();
                expect(zyNode.problems[0].errorType).toEqual(ErrorsCodes.PACKAGE_FILE_INVALID);

            }).then(done, done);

        });

        it('should detect when a package.json file shows some errors.', function (done) {

            _runListDependencies().then(function (dependencyTree) {
                var zxNode = dependencyTree.children.regular[nodesPosition.zx];

                expect(zxNode.problems).toBeDefined();
                expect(zxNode.problems[0].errorType).toEqual(ErrorsCodes.PACKAGE_FILE_INVALID);

            }).then(done, done);

        });

        it('should detect when the project package.json file shows some errors.', function(done) {

            mockFS = QFSMock(ProjectFSMocksFactory({
                name: DEFAULT_PROJECT_APP,
                version: '0.1.1',
                jsonFileError: true
            }));

            PackageManagerService(null, mockFS).listDependenciesAtUrl('/').then(function (dependencyTree) {
                expect(dependencyTree.jsonFileError).toEqual(true);

            }).then(done, done);

        });

        it('should not complain if no dependencies are required.', function (done) {

            mockFS = QFSMock(ProjectFSMocksFactory({
                name: DEFAULT_PROJECT_APP,
                version: '0.1.1'
            }));

            PackageManagerService(null, mockFS).listDependenciesAtUrl('/').then(function (dependencyTree) {
                expect(dependencyTree.children.regular.length).toEqual(0);

            }).then(done, done);

        });

        it('should detect when the project package.json file is missing or empty', function (done) {

            mockFS = QFSMock({
                "package.json": "{}"
            });

            PackageManagerService(null, mockFS).listDependenciesAtUrl('/').then(function (dependencyTree) {
                expect(dependencyTree.jsonFileMissing).toEqual(true);

            }).then(done, done);

        });

        it('should detect if a package.json has an end line or not', function (done) {

            mockFS = QFSMock({
                "package.json": "{}\n"
            });

            PackageManagerService(mockFS).listDependenciesAtUrl('/').then(function (dependencyTree) {
                expect(dependencyTree.endLine).toEqual(true);

                mockFS = QFSMock({
                    "package.json": "{}"
                });
            }).then(function () {
                return PackageManagerService(mockFS).listDependenciesAtUrl('/').then(function (dependencyTree) {
                    expect(dependencyTree.endLine).toEqual(false);
                });
            }).then(done, done);
        });

    });

});
