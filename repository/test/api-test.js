const express = require('express');
const request = require('supertest');
const chai = require('chai');
const spies = require('chai-spies');
const { expect } = chai;
const routes = require('../routes');
const fs = require('fs');
const path = require('path');
const rimraf = require('rimraf');
const nodegit = require('nodegit');

chai.use(spies);

describe('Api', () => {
    let app;

    beforeEach(() => {
        app = express();
        routes(app, nodegit);
    });

    afterEach((done) => {
        rimraf('tmp', e => done(e));
        chai.spy.restore();
    });

    describe('GET /repository', () => {
        it('returns a 404 if the path does not exist', (done) => {
            request(app)
                .get(`/repository?path=${encodeURIComponent('non/existent')}`)
                .expect(404, done);
        });

        it('returns a 404 if the directory is not a git repo', (done) => {
            fs.mkdirSync('tmp');
            request(app)
                .get(`/repository?path=${encodeURIComponent('tmp')}`)
                .expect(404, done);
        });

        it('returns a 200 if the repository exists', (done) => {
            nodegit.Repository.init('tmp', 0)
                .then(() => {
                    request(app)
                        .get(`/repository?path=${encodeURIComponent('tmp')}`)
                        .expect(200, done);
                });
        });
    });

    describe('POST /repository', () => {
        it('returns a 400 if path query is not supplied', (done) => {
            request(app)
                .post('/repository')
                .expect(400, done);
        });
        it('initializes a new repository if no repositoryUrl is given', (done) => {
            chai.spy.on(nodegit.Repository, 'init', async () => ({}));
            request(app, nodegit)
                .post(`/repository`)
                .send({ path: 'tmp' })
                .expect(200)
                .end((err, res) => {
                    if (err) return done(err);
                    expect(nodegit.Repository.init).to.have.been.called.with('tmp');
                    done();
                });
        });
        it('returns a 400 if a repositoryUrl is given but the repo could not be cloned', (done) => {
            chai.spy.on(nodegit, 'Clone', async () => {
                throw new Error();
            });
            request(app)
                .post(`/repository`)
                .send({ path: 'tmp', repositoryUrl: 'git@github.com:montagejs/montage' })
                .expect(400, done);
        });
        it('clones a repository with the correct repositoryUrl', (done) => {
            chai.spy.on(nodegit, 'Clone', async () => ({}));
            request(app)
                .post(`/repository`)
                .send({ path: 'tmp', repositoryUrl: 'git@github.com:montagejs/montage' })
                .expect(200)
                .end((err, res) => {
                    if (err) throw err;
                    expect(nodegit.Clone).to.have.been.called.with('git@github.com:montagejs/montage', 'tmp');
                    done();
                });
        });
    });
});
