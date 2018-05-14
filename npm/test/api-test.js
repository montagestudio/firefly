const express = require("express");
const request = require("supertest");
const chai = require("chai");
const spies = require("chai-spies");
const { expect } = chai;
const path = require("path");
const routes = require("../routes");

chai.use(spies);

let app;

describe("Api", () => {
    beforeEach(() => {
        app = express();
        routes(app);
    });

    describe("GET /dependencies", () => {
        describe("no errors situation", () => {
            it('should gather some correct information about the project.', (done) => {
                request(app)
                    .get("/dependencies?url=" + path.join(__dirname, "fixtures"))
                    .expect(200)
                    .end((err, res) => {
                        if (err) throw err;
                        var dependencyTree = res.body;
                        expect(typeof dependencyTree).toEqual("object");
                        expect(dependencyTree.name).toEqual(DEFAULT_PROJECT_APP);
                        expect(dependencyTree.version).toEqual('0.1.0');
                        expect(dependencyTree.fileJsonRaw).toBeDefined();
                        expect(dependencyTree.children.regular.length).toBeGreaterThan(0);
                        expect(dependencyTree.children.dev.length).toBeGreaterThan(0);
                        expect(dependencyTree.children.optional.length).toBeGreaterThan(0);
                        expect(dependencyTree.bundled.length).toBeGreaterThan(0);
                        done();
                    });
            });

            it('should detect when an ancestor is used by a deeper dependency.', (done) => {
                request(app)
                    .get("/dependencies?url=" + path.join(__dirname, "fixtures"))
                    .expect(200)
                    .end((err, res) => {
                        if (err) throw err;
                        /*
                        * Within the sample the module Montage has a dependency Joey which needs the module Q.
                        * This module should be a reference to the module Q that can be found within the optional Dependencies.
                        */
                        const montageNode = res.children.regular[nodesPosition.montage];
                        expect(montageNode.problems).not.toBeDefined();
                        done();
                    });
            });

            it('should have no errors in this situation.', (done) => {
                request(app)
                    .get("/dependencies?url=" + path.join(__dirname, "fixtures"))
                    .expect(200)
                    .end((err, res) => {
                        if (err) throw err;
                        const { children } = res.body,
                            childrenKeys = Object.keys(children);
                        childrenKeys.forEach((childrenKey) => {
                            const childrenCategory = children[childrenKey];
                            childrenCategory.forEach((category) => {
                                expect(childrenCategory.problems).not.toBeDefined();
                            });
                        });
                        done();
                    });
            });

            it('a dependency is not extraneous if it belongs to the "bundledDependencies" field.', (done) => {
                request(app)
                    .get("/dependencies?url=" + path.join(__dirname, "fixtures"))
                    .expect(200)
                    .end((err, res) => {
                        if (err) throw err;
                        const zipNode = dependencyTree.children.regular[nodesPosition.zip];
                        expect(zipNode.problems).not.toBeDefined();
                        expect(dependencyTree.bundled[2]).toEqual(zipNode.name);
                        done();
                    });
            });

            it('a dependency is not missing if it belongs to the "devDependencies" or the "optionalDependencies" field.', (done) => {
                request(app)
                    .get("/dependencies?url=" + path.join(__dirname, "fixtures"))
                    .expect(200)
                    .end((err, res) => {
                        if (err) throw err;
                        const sipNode = dependencyTree.children.optional[nodesPosition.sip];
                        expect(sipNode.problems).not.toBeDefined();
                        expect(sipNode.type).toEqual(DEPENDENCY_CATEGORIES.OPTIONAL);
                        const underscoreNode = dependencyTree.children.dev[nodesPosition.underscore];
                        expect(underscoreNode.problems).not.toBeDefined();
                        expect(underscoreNode.type).toEqual(DEPENDENCY_CATEGORIES.DEV);
                        done();
                });
            });
        });

        describe("errors situation:", function () {
            it('should detect when a regular dependency is missing.', (done) => {
                request(app)
                    .get("/dependencies?url=" + path.join(__dirname, "fixtures"))
                    .expect(200)
                    .end((err, res) => {
                        if (err) throw err;
                        const digitNode = res.body.children.regular[nodesPosition.digit];
                        expect(digitNode.missing).toEqual(true);
                        expect(digitNode.type).toEqual(DEPENDENCY_CATEGORIES.REGULAR);
                        expect(digitNode.problems).toBeDefined();
                        expect(digitNode.problems[0].errorType).toEqual(ErrorsCodes.DEPENDENCY_MISSING);
                        expect(dependencyTree.children.regular[nodesPosition.filament].missing).toEqual(false);
                        done();
                });
            });

            it('should detect an extraneous dependency.', function(done) {
                request(app)
                    .get("/dependencies?url=" + path.join(__dirname, "fixtures"))
                    .expect(200)
                    .end((err, res) => {
                        if (err) throw err;
                        const filamentNode = dependencyTree.children.regular[nodesPosition.filament];
                        expect(filamentNode.extraneous).toEqual(true);
                        expect(filamentNode.problems).toBeDefined();
                        expect(filamentNode.problems[0].errorType).toEqual(ErrorsCodes.DEPENDENCY_EXTRANEOUS);
                        done();
                });
            });

            it('should detect an invalid regular or optional dependency version.', (done) => {
                request(app)
                    .get("/dependencies?url=" + path.join(__dirname, "fixtures"))
                    .expect(200)
                    .end((err, res) => {
                        if (err) throw err;
                        const { dependencyTree } = res.body;
                        const montageNode = dependencyTree.children.regular[nodesPosition.montage];
                        expect(montageNode.type).toEqual(DEPENDENCY_CATEGORIES.REGULAR);
                        expect(montageNode.problems).toBeDefined();
                        expect(montageNode.problems[0].errorType).toEqual(ErrorsCodes.VERSION_INVALID);
                        const montageTestingNode = dependencyTree.children.optional[nodesPosition["montage-testing"]];
                        expect(montageTestingNode.type).toEqual(DEPENDENCY_CATEGORIES.OPTIONAL);
                        expect(montageTestingNode.problems).toBeDefined();
                        expect(montageTestingNode.problems[0].errorType).toEqual(ErrorsCodes.VERSION_INVALID);
                        const nativeNode = dependencyTree.children.dev[nodesPosition.native];
                        expect(nativeNode.type).toEqual(DEPENDENCY_CATEGORIES.DEV);
                        expect(nativeNode.problems).not.toBeDefined();
                        done();
                });
            });

            it('should detect an invalid ancestor which its used by a deeper dependency.', (done) => {
                request(app)
                    .get("/dependencies?url=" + path.join(__dirname, "fixtures"))
                    .expect(200)
                    .end((err, res) => {
                        if (err) throw err;
                        const montageNode = res.body.children.regular[nodesPosition.montage];
                        expect(montageNode.problems).toBeDefined();
                        expect(montageNode.problems[1].errorType).toEqual(ErrorsCodes.DEPENDENCY_MISSING);
                        // the module joey needs a valid version of the package named zip.
                        expect(montageNode.problems[2].errorType).toEqual(ErrorsCodes.VERSION_INVALID);
                        done();
                });
            });

            it('should detect when a package.json file is missing.', (done) => {
                request(app)
                    .get("/dependencies?url=" + path.join(__dirname, "fixtures"))
                    .expect(200)
                    .end((err, res) => {
                        if (err) throw err;
                        const zyNode = res.body.children.regular[nodesPosition.zy];
                        expect(zyNode.problems).toBeDefined();
                        expect(zyNode.problems[0].errorType).toEqual(ErrorsCodes.PACKAGE_FILE_INVALID);
                        done();
                });
            });

            it('should detect when a package.json file shows some errors.', (done) => {
                request(app)
                    .get("/dependencies?url=" + path.join(__dirname, "fixtures"))
                    .expect(200)
                    .end((err, res) => {
                        if (err) throw err;
                        const zxNode = res.body.children.regular[nodesPosition.zx];
                        expect(zxNode.problems).toBeDefined();
                        expect(zxNode.problems[0].errorType).toEqual(ErrorsCodes.PACKAGE_FILE_INVALID);
                        done();
                });
            });

            it('should detect when the project package.json file shows some errors.', function(done) {
                // mockFS = QFSMock(ProjectFSMocksFactory({
                //     name: DEFAULT_PROJECT_APP,
                //     version: '0.1.1',
                //     jsonFileError: true
                // }));
                request(app)
                    .get("/dependencies?url=" + path.join(__dirname, "fixtures"))
                    .expect(200)
                    .end((err, res) => {
                        if (err) throw err;
                        expect(res.body.jsonFileError).toEqual(true);
                        done();
                });
            });

            it('should not complain if no dependencies are required.', (done) => {
                // mockFS = QFSMock(ProjectFSMocksFactory({
                //     name: DEFAULT_PROJECT_APP,
                //     version: '0.1.1'
                // }));
                request(app)
                    .get("/dependencies?url=" + path.join(__dirname, "fixtures"))
                    .expect(200)
                    .end((err, res) => {
                        if (err) throw err;
                        expect(res.body.children.regular.length).toEqual(0);
                        done();
                });
            });

            it('should detect when the project package.json file is missing or empty', (done) => {
                // mockFS = QFSMock({
                //     "package.json": "{}"
                // });
                request(app)
                    .get("/dependencies?url=" + path.join(__dirname, "fixtures"))
                    .expect(200)
                    .end((err, res) => {
                        if (err) throw err;
                        expect(res.body.jsonFileMissing).toEqual(true);
                        done();
                });
            });

            it('should detect if a package.json has an end line or not', (done) => {
                // mockFS = QFSMock({
                //     "package.json": "{}\n"
                // });
                request(app)
                    .get("/dependencies?url=" + path.join(__dirname, "fixtures"))
                    .expect(200)
                    .end((err, res) => {
                        if (err) throw err;
                        expect(res.body.endLine).toEqual(true);
                        done();
                    });
            });
        });
    });
});
