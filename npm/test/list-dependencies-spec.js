'use strict';

const express = require("express");
const request = require("supertest");
const chai = require("chai");
const spies = require("chai-spies");
const expect = chai.expect;
const routes = require("../routes");
const fsSample = require("./mocks/fs-sample");
const fsFactory = require("./mocks/fs-factory");
const mockFs = require("mock-fs");
const DEPENDENCY_CATEGORIES = require("../dependency-node").DEPENDENCY_CATEGORIES;
const ERROR_TYPES = require("../error-codes");

const DEFAULT_PROJECT_NAME = 'project-fs-sample';

chai.use(spies);

describe("GET /dependencies", () => {
    let app;

    describe("no errors situation", () => {
        beforeEach(() => {
            app = express();
            mockFs(fsSample(DEFAULT_PROJECT_NAME, false));
            routes(app);
        });

        it('should gather some correct information about the project.', (done) => {
            request(app)
                .get(`/dependencies?url=${encodeURIComponent('./')}`)
                .expect(200)
                .end((err, res) => {
                    if (err) throw err;
                    const dependencyTree = res.body;
                    expect(typeof dependencyTree).to.equal("object");
                    expect(dependencyTree.name).to.equal(DEFAULT_PROJECT_NAME);
                    expect(dependencyTree.version).to.equal('0.1.0');
                    expect(dependencyTree.fileJsonRaw).to.not.be.undefined;
                    expect(dependencyTree.children.regular.length).to.be.above(0);
                    expect(dependencyTree.children.dev.length).to.be.above(0);
                    expect(dependencyTree.children.optional.length).to.be.above(0);
                    expect(dependencyTree.bundled.length).to.be.above(0);
                    done();
                });
        });

        it('should detect when an ancestor is used by a deeper dependency.', (done) => {
            request(app)
                .get(`/dependencies?url=${encodeURIComponent('./')}`)
                .expect(200)
                .end((err, res) => {
                    if (err) throw err;
                    /*
                    * Within the sample the module Montage has a dependency Joey which needs the module Q.
                    * This module should be a reference to the module Q that can be found within the optional Dependencies.
                    */
                    const montageNode = res.body.children.regular.filter((dep) => dep.name === 'montage')[0];
                    expect(montageNode.problems).to.be.undefined;
                    done();
                });
        });

        it('should have no errors in this situation.', (done) => {
            request(app)
                .get(`/dependencies?url=${encodeURIComponent('./')}`)
                .expect(200)
                .end((err, res) => {
                    if (err) throw err;
                    const children = res.body.children;
                    Object.values(children).forEach((category) => expect(category.problems).to.be.undefined);
                    done();
                });
        });

        it('a dependency is not extraneous if it belongs to the "bundledDependencies" field.', (done) => {
            request(app)
                .get(`/dependencies?url=${encodeURIComponent('./')}`)
                .expect(200)
                .end((err, res) => {
                    if (err) throw err;
                    const dependencyTree = res.body;
                    const zipNode = dependencyTree.children.regular.filter((dep) => dep.name === 'zip')[0];
                    expect(zipNode.problems).to.be.undefined;
                    expect(dependencyTree.bundled[2]).to.equal(zipNode.name);
                    done();
                });
        });

        it('a dependency is not missing if it belongs to the "devDependencies" or the "optionalDependencies" field.', (done) => {
            request(app)
                .get(`/dependencies?url=${encodeURIComponent('./')}`)
                .expect(200)
                .end((err, res) => {
                    if (err) throw err;
                    const dependencyTree = res.body;
                    const sipNode = dependencyTree.children.optional.filter((dep) => dep.name === 'sip')[0];
                    expect(sipNode.problems).to.be.undefined;
                    expect(sipNode.type).to.equal(DEPENDENCY_CATEGORIES.OPTIONAL);
                    const underscoreNode = dependencyTree.children.dev.filter((dep) => dep.name === 'underscore')[0];
                    expect(underscoreNode.problems).to.be.undefined;
                    expect(underscoreNode.type).to.equal(DEPENDENCY_CATEGORIES.DEV);
                    done();
            });
        });
    });

    describe("errors situation:", function () {
        beforeEach(() => {
            app = express();
            mockFs(fsSample(DEFAULT_PROJECT_NAME, true));
            routes(app);
        });

        it('should detect when a regular dependency is missing.', (done) => {
            request(app)
                .get(`/dependencies?url=${encodeURIComponent('./')}`)
                .expect(200)
                .end((err, res) => {
                    if (err) throw err;
                    const dependencyTree = res.body;
                    const digitNode = res.body.children.regular.filter((dep) => dep.name === 'digit')[0];
                    expect(digitNode.missing).to.equal(true);
                    expect(digitNode.type).to.equal(DEPENDENCY_CATEGORIES.REGULAR);
                    expect(digitNode.problems).to.not.be.undefined;
                    expect(digitNode.problems[0].errorType).to.equal(ERROR_TYPES.DEPENDENCY_MISSING);
                    expect(dependencyTree.children.regular.filter((dep) => dep.name === 'filament')[0].missing).to.equal(false);
                    done();
            });
        });

        it('should detect an extraneous dependency.', function(done) {
            request(app)
                .get(`/dependencies?url=${encodeURIComponent('./')}`)
                .expect(200)
                .end((err, res) => {
                    if (err) throw err;
                    const dependencyTree = res.body;
                    const filamentNode = dependencyTree.children.regular.filter((dep) => dep.name === 'filament')[0];
                    expect(filamentNode.extraneous).to.equal(true);
                    expect(filamentNode.problems).to.not.be.undefined;
                    expect(filamentNode.problems[0].errorType).to.equal(ERROR_TYPES.DEPENDENCY_EXTRANEOUS);
                    done();
            });
        });

        it('should detect an invalid regular or optional dependency version.', (done) => {
            request(app)
                .get(`/dependencies?url=${encodeURIComponent('./')}`)
                .expect(200)
                .end((err, res) => {
                    if (err) throw err;
                    const dependencyTree = res.body;
                    const montageNode = dependencyTree.children.regular.filter((dep) => dep.name === 'montage')[0];
                    expect(montageNode.type).to.equal(DEPENDENCY_CATEGORIES.REGULAR);
                    expect(montageNode.problems).to.not.be.undefined;
                    expect(montageNode.problems[0].errorType).to.equal(ERROR_TYPES.VERSION_INVALID);
                    const montageTestingNode = dependencyTree.children.optional.filter((dep) => dep.name === 'montage-testing')[0];
                    expect(montageTestingNode.type).to.equal(DEPENDENCY_CATEGORIES.OPTIONAL);
                    expect(montageTestingNode.problems).to.not.be.undefined;
                    expect(montageTestingNode.problems[0].errorType).to.equal(ERROR_TYPES.VERSION_INVALID);
                    const nativeNode = dependencyTree.children.dev.filter((dep) => dep.name === 'native')[0];
                    expect(nativeNode.type).to.equal(DEPENDENCY_CATEGORIES.DEV);
                    expect(nativeNode.problems).to.be.undefined;
                    done();
            });
        });

        it('should detect an invalid ancestor which its used by a deeper dependency.', (done) => {
            request(app)
                .get(`/dependencies?url=${encodeURIComponent('./')}`)
                .expect(200)
                .end((err, res) => {
                    if (err) throw err;
                    const montageNode = res.body.children.regular.filter((dep) => dep.name === 'montage')[0];
                    expect(montageNode.problems).to.not.be.undefined;
                    expect(montageNode.problems[1].errorType).to.equal(ERROR_TYPES.DEPENDENCY_MISSING);
                    // the module joey needs a valid version of the package named zip.
                    expect(montageNode.problems[2].errorType).to.equal(ERROR_TYPES.VERSION_INVALID);
                    done();
            });
        });

        it('should detect when a package.json file is missing.', (done) => {
            request(app)
                .get(`/dependencies?url=${encodeURIComponent('./')}`)
                .expect(200)
                .end((err, res) => {
                    if (err) throw err;
                    const zyNode = res.body.children.regular.filter((dep) => dep.name === 'zy')[0];
                    expect(zyNode.problems).to.not.be.undefined;
                    expect(zyNode.problems[0].errorType).to.equal(ERROR_TYPES.PACKAGE_FILE_INVALID);
                    done();
            });
        });

        it('should detect when a package.json file shows some errors.', (done) => {
            request(app)
                .get(`/dependencies?url=${encodeURIComponent('./')}`)
                .expect(200)
                .end((err, res) => {
                    if (err) throw err;
                    const zxNode = res.body.children.regular.filter((dep) => dep.name === 'zx')[0];
                    expect(zxNode.problems).to.not.be.undefined;
                    expect(zxNode.problems[0].errorType).to.equal(ERROR_TYPES.PACKAGE_FILE_INVALID);
                    done();
            });
        });

        it('should detect when the project package.json file shows some errors.', function(done) {
            mockFs.restore();
            mockFs(fsFactory({
                name: DEFAULT_PROJECT_NAME,
                version: '0.1.1',
                jsonFileError: true
            }));
            request(app)
                .get(`/dependencies?url=${encodeURIComponent('./')}`)
                .expect(200)
                .end((err, res) => {
                    if (err) throw err;
                    expect(res.body.jsonFileError).to.equal(true);
                    done();
            });
        });

        it('should not complain if no dependencies are required.', (done) => {
            mockFs.restore();
            mockFs(fsFactory({
                name: DEFAULT_PROJECT_NAME,
                version: '0.1.1'
            }));
            request(app)
                .get(`/dependencies?url=${encodeURIComponent('./')}`)
                .expect(200)
                .end((err, res) => {
                    if (err) throw err;
                    expect(res.body.children.regular.length).to.equal(0);
                    done();
            });
        });

        it('should detect when the project package.json file is missing or empty', (done) => {
            mockFs.restore();
            mockFs({
                "package.json": "{}"
            });
            request(app)
                .get(`/dependencies?url=${encodeURIComponent('./')}`)
                .expect(200)
                .end((err, res) => {
                    if (err) throw err;
                    expect(res.body.jsonFileMissing).to.equal(true);
                    done();
            });
        });

        it('should detect if a package.json has an end line or not', (done) => {
            mockFs.restore();
            mockFs({
                "package.json": "{}\n"
            });
            request(app)
                .get(`/dependencies?url=${encodeURIComponent('./')}`)
                .expect(200)
                .end((err, res) => {
                    if (err) throw err;
                    expect(res.body.endLine).to.equal(true);
                    done();
                });
        });
    });
});
