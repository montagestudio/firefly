const express = require("express");
const request = require("supertest");
const { expect } = require("chai");
const routes = require("../routes");
const fsSample = require("./mocks/fs-sample");
const ErrorsCodes = require("../error-codes");

xdescribe("DELETE /dependencies", () => {
    let app;

    beforeEach(() => {
        app = express();
        const mockFs = fsSample();
        routes(app, mockFs);
    });

    it('should remove a specified dependency.', function (done) {
        request(app)
            .delete("/dependencies/montage?location=/")
            .expect(200)
            .end((err, res) => {
                if (err) throw err;
                expect(typeof res.body).to.equal("object");
                expect(res.body.name).to.equal("montage");
                done();
            });
    });

    it('should throw an error when the dependency name is not a valid string.', function (done) {
        request(app)
            .delete("/dependencies/42?location=/")
            .expect(400)
            .end((err) => {
                if (err) throw err;
                console.log("test err", err);
                expect(err.code).to.equal(ErrorsCodes.DEPENDENCY_NAME_NOT_VALID);
                done();
            });
    });

    it('should throw an error it does not find a package', function (done) {
        request(app)
            .delete("/dependencies/montage?location=/42")
            .expect(400)
            .end((err) => {
                if (err) throw err;
                console.log("test err", err);
                expect(err.code).to.equal(ErrorsCodes.DEPENDENCY_NOT_FOUND);
                done();
            });
    });
});
