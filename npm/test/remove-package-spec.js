'use strict';

const express = require("express");
const request = require("supertest");
const expect = require("chai").expect;
const routes = require("../routes");
const projectFSMocks = require("./mocks/project-fs-sample");
const ErrorsCodes = require("../error-codes");

describe("DELETE /dependencies", () => {
    let app;

    beforeEach(() => {
        app = express();
        const mockFs = projectFSMocks();
        routes(app, mockFs);
    });

    it('should remove a specified dependency.', function (done) {
        request(app)
            .delete(`/dependencies/montage?location=${encodeURI('/')}`)
            .expect(200)
            .end((err, res) => {
                if (err) throw err;
                expect(typeof res.body).to.equal("object");
                expect(res.body.name).to.equal("montage");
                done();
            });
    });

    it('should throw an error it does not find a package', function (done) {
        request(app)
            .delete(`/dependencies/montage?location=${encodeURI('/42')}`)
            .expect(400)
            .end((err, res) => {
                if (err) throw err;
                expect(res.body.code).to.equal(ErrorsCodes.DEPENDENCY_NOT_FOUND);
                done();
            });
    });
});
