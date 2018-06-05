'use strict';

const express = require("express");
const request = require("supertest");
const expect = require("chai").expect;
const routes = require("../routes");
const npm = require('npm');

describe("GET /dependencies", function () {
    let app;

    beforeEach(() => {
        app = express();
        routes(app, npm, 'test/fixtures');
    });

    it('should throw an error if the request is not valid.', function (done) {
        request(app)
            .get(`/package/dependencies/montage@1.0?prefix=no-errors`)
            .expect(400)
            .end((err, res) => {
                expect(res.body.code).to.equal(3001);
                done();
            });
    });

    it("should get some information about montage@0.13.0.", function (done) {
        request(app)
            .get(`/package/dependencies/montage@0.13.0?prefix=no-errors`)
            .expect(200)
            .end((err, res) => {
                if (err) throw err;
                expect(res.body.name).to.equal('montage');
                expect(res.body.version).to.equal('0.13.0');
                done(err);
            });
    });
});
