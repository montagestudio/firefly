const express = require("express");
const request = require("supertest");
const { expect } = require("chai");
const routes = require("../routes");
const fs = require("fs");

describe("GET /dependencies", function () {
    let app;
    
    beforeEach(() => {
        app = express();
        routes(app, fs);
    });

    it('should throw an error if the request is not valid.', function (done) {
        request(app)
            .get("/dependencies/montage@1.0")
            .expect(400)
            .end((err) => {
                expect(err.code).toEqual(3001);
                done();
            });
    });

    it("should get some information about montage@0.13.0.", function (done) {
        request(app)
            .get("/dependencies/montage@0.13.0")
            .expect(200)
            .expect({ name: 'montage', version: '0.13.0' }, done);
    });
});
