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
                }, done);
        });
    });

    describe('POST /repository', () => {
        it('returns a 400 if path is not supplied', (done) => {
            request(app)
                .post('/repository')
                .expect(400, done);
        });
        describe('creating a repository', () => {
            it('initializes a new repository if no repositoryUrl is given', (done) => {
                chai.spy.on(nodegit.Repository, 'init', async () => ({}));
                request(app)
                    .post(`/repository`)
                    .send({ path: 'tmp' })
                    .expect(200)
                    .end((err, res) => {
                        if (err) return done(err);
                        expect(nodegit.Repository.init).to.have.been.called.with('tmp');
                        done();
                    });
            });
            it('adds a given remote to the new repository', (done) => {
                const fakeRepo = {};
                chai.spy.on(nodegit.Repository, 'init', async () => fakeRepo);
                chai.spy.on(nodegit.Remote, 'create', async () => ({}));
                request(app)
                    .post('/repository')
                    .send({ path: 'tmp', remoteUrl: 'git@github.com:owner/repo' })
                    .expect(200)
                    .end((err, res) => {
                        if (err) return done(err);
                        expect(nodegit.Remote.create).to.have.been.called.with(fakeRepo, 'origin', 'git@github.com:owner/repo');
                        done();
                    });
            });
            it('configures the repository with name and email', (done) => {
                const fakeConfig = chai.spy.interface({
                    async setString(name, value) {}
                });
                chai.spy.on(nodegit.Repository, 'init', async () => ({
                    async config() { return fakeConfig; }
                }));
                request(app)
                    .post('/repository')
                    .send({ path: 'tmp', name: 'owner', email: 'owner@foo.com' })
                    .expect(200)
                    .end((err, res) => {
                        if (err) return done(err);
                        expect(fakeConfig.setString).to.have.been.called.with('user.name', 'owner');
                        expect(fakeConfig.setString).to.have.been.called.with('user.email', 'owner@foo.com');
                        done();
                    });
            });
        })
        describe('cloning a repository', () => {
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
        describe('commit', () => {
            let repository;

            beforeEach(async () => {
                repository = await nodegit.Repository.init('tmp', 0);
            });

            it('returns a 400 if the given repository path cannot be opened', (done) => {
                request(app)
                    .post('/repository/commit')
                    .send({ path: 'nonexistent', message: 'initial commit' })
                    .expect(400, done);
            });

            it('returns a 400 if no message is given', (done) => {
                request(app)
                    .post('/repository/commit')
                    .send({ path: 'tmp' })
                    .expect(400, done);
            });

            it('commits specific files', (done) => {
                fs.writeFileSync('tmp/a.txt', 'a');
                fs.writeFileSync('tmp/b.txt', 'b');
                request(app)
                    .post('/repository/commit')
                    .send({ path: 'tmp', message: 'initial commit', fileUrls: ['a.txt'] })
                    .expect(200)
                    .end((err, res) => {
                        if (err) return done(err);
                        repository.getHeadCommit()
                            .then((commit) => {
                                expect(commit.message()).to.equal('initial commit');
                                return repository.getStatus();
                            })
                            .then((status) => {
                                expect(status.length).to.equal(1);
                            })
                            .then(done, done);
                    });
            });

            it('commits all files if no fileUrls are specified', (done) => {
                fs.writeFileSync('tmp/a.txt', 'a');
                fs.writeFileSync('tmp/b.txt', 'b');
                request(app)
                    .post('/repository/commit')
                    .send({ path: 'tmp', message: 'initial commit' })
                    .expect(200)
                    .end((err, res) => {
                        if (err) return done(err);
                        repository.getHeadCommit()
                            .then((commit) => {
                                expect(commit.message()).to.equal('initial commit');
                                return repository.getStatus();
                            })
                            .then((status) => {
                                expect(status.length).to.equal(0);
                            })
                            .then(done, done);
                    });
            });

            it('returns a 400 if one of the given fileUrls cannot be opened', (done) => {
                fs.writeFileSync('tmp/a.txt', 'a');
                request(app)
                    .post('/repository/commit')
                    .send({ path: 'tmp', message: 'initial commit', fileUrls: ['a.txt', 'nonexistent'] })
                    .expect(400, done);
            });
        });
    });
});
