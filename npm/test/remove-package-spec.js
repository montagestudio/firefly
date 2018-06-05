'use strict';

const express = require("express");
const request = require("supertest");
const expect = require("chai").expect;
const routes = require("../routes");
const ErrorsCodes = require("../error-codes");
const npm = require('npm');
const FS = require('q-io/fs');

describe("DELETE /dependencies", () => {
    let app;

    beforeEach((done) => {
        app = express();
        FS.copyTree('test/fixtures', 'tmp')
            .then(() => {
                routes(app, npm, 'tmp');
                done();
            })
            .catch(done);
    });

    afterEach((done) => {
        FS.removeTree('tmp')
            .then(() => done())
            .catch(done);
    });

    it('should remove a specified dependency.', function (done) {
        request(app)
            .delete(`/package/dependencies/montage`)
            .send({ prefix: 'no-errors' })
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
            .delete(`/package/dependencies/nonexistentent`)
            .send({ prefix: 'no-errors' })
            .expect(400)
            .end((err, res) => {
                if (err) throw err;
                expect(res.body.code).to.equal(ErrorsCodes.DEPENDENCY_NOT_FOUND);
                done();
            });
    });
});
