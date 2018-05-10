const express = require("express");
const request = require("supertest");
const chai = require("chai");
const spies = require("chai-spies");
const { expect } = chai;
const routes = require("../routes");

chai.use(spies);

const gitMock = chai.spy.interface({
    async Clone(repositoryUrl, directory) {

    }
});

let app;

describe("Api", () => {
    beforeEach(() => {
        app = express();
        routes(app, gitMock);
    });

    describe("/clone", () => {
        it("returns an error if repositoryUrl is not supplied", (done) => {
            request(app)
                .post("/clone")
                .send({
                    directory: "/foo/bar"
                })
                .expect(400)
                .end((err, res) => {
                    if (err) throw err;
                    done();
                });
        });
        it("returns an error if directory is not supplied", (done) => {
            request(app)
                .post("/clone")
                .send({
                    repositoryUrl: "git@github.com:montagejs/montage"
                })
                .expect(400)
                .end((err, res) => {
                    if (err) throw err;
                    done();
                });
        });
        it("clones a repository with the correct repositoryUrl and directory", (done) => {
            request(app)
                .post("/clone")
                .send({
                    repositoryUrl: "git@github.com:montagejs/montage",
                    directory: "/tmp/firefly-repository-test"
                })
                .expect(200)
                .end((err, res) => {
                    if (err) throw err;
                    expect(gitMock.Clone).to.have.been.called.with("git@github.com:montagejs/montage", "/tmp/firefly-repository-test");
                    done();
                });
        });
    });
});
