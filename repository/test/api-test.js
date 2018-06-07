const express = require('express');
const request = require('supertest');
const chai = require('chai');
const spies = require('chai-spies');
const { expect } = chai;
const routes = require('../routes');
const fs = require('fs');
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
        it('returns a 404 if the path does not exist', async () => {
            await request(app)
                .get(`/repository?path=${encodeURIComponent('non/existent')}`)
                .expect(404);
        });

        it('returns a 404 if the directory is not a git repo', async () => {
            fs.mkdirSync('tmp');
            await request(app)
                .get(`/repository?path=${encodeURIComponent('tmp')}`)
                .expect(404);
        });

        it('returns a 200 if the repository exists', async () => {
            await nodegit.Repository.init('tmp', 0)
            await request(app)
                .get(`/repository?path=${encodeURIComponent('tmp')}`)
                .expect(200);
        });
    });

    describe('POST /repository', () => {
        describe('creating a repository', () => {
            it('returns a 400 if path is not supplied', async () => {
                await request(app)
                    .post('/repository')
                    .expect(400);
            });
            it('initializes a new repository if no repositoryUrl is given', async () => {
                await request(app)
                    .post(`/repository`)
                    .send({ path: 'tmp' })
                    .expect(200);
                await nodegit.Repository.open('tmp');
            });
            it('adds a given remote to the new repository', async () => {
                await request(app)
                    .post('/repository')
                    .send({ path: 'tmp', remoteUrl: 'git@github.com:owner/repo' })
                    .expect(200)
                const repo = await nodegit.Repository.open('tmp');
                const remote = await repo.getRemote('origin');
                expect(remote.url(), 'git@github.com:owner/repo');
            });
            it('configures the repository with name and email', async () => {
                await request(app)
                    .post('/repository')
                    .send({ path: 'tmp', name: 'owner', email: 'owner@foo.com' })
                    .expect(200)
                const repo = await nodegit.Repository.open('tmp');
                const config = await repo.config();
                expect(config.getStringBuf('user.name').toString(), 'owner');
                expect(config.getStringBuf('user.email').toString(), 'owner@foo.com');
            });
        })
        describe('cloning a repository', () => {
            it('returns a 400 if a repositoryUrl is given but the repo could not be cloned', async () => {
                chai.spy.on(nodegit, 'Clone', async () => {
                    throw new Error();
                });
                await request(app)
                    .post(`/repository`)
                    .send({ path: 'tmp', repositoryUrl: 'git@github.com:montagejs/montage' })
                    .expect(400);
            });
            it('clones an actual repository over http', async () => {
                await request(app)
                    .post(`/repository`)
                    .send({ path: 'tmp', repositoryUrl: 'http://github.com/montagejs/popcorn' })
                    .expect(200);
                await nodegit.Repository.open('tmp');
            }).timeout(15000);
            it('clones an actual repository over https', async () => {
                await request(app)
                    .post(`/repository`)
                    .send({ path: 'tmp', repositoryUrl: 'https://github.com/montagejs/popcorn' })
                    .expect(200);
                await nodegit.Repository.open('tmp');
            }).timeout(15000);
        });
    });
    describe('POST /repository/commit', () => {
        let repository;

        beforeEach(async () => {
            repository = await nodegit.Repository.init('tmp', 0);
        });

        it('returns a 400 if the given repository path cannot be opened', async () => {
            await request(app)
                .post('/repository/commit')
                .send({ path: 'nonexistent', message: 'initial commit' })
                .expect(400);
        });

        it('returns a 400 if no message is given', async () => {
            await request(app)
                .post('/repository/commit')
                .send({ path: 'tmp' })
                .expect(400);
        });

        it('commits specific files', async () => {
            fs.writeFileSync('tmp/a.txt', 'a');
            fs.writeFileSync('tmp/b.txt', 'b');
            await request(app)
                .post('/repository/commit')
                .send({ path: 'tmp', message: 'initial commit', fileUrls: ['a.txt'] })
                .expect(200)
            const commit = await repository.getHeadCommit();
            expect(commit.message()).to.equal('initial commit');
            const status = await repository.getStatus();
            expect(status.length).to.equal(1);
        });

        it('commits all files if no fileUrls are specified', async () => {
            fs.writeFileSync('tmp/a.txt', 'a');
            fs.writeFileSync('tmp/b.txt', 'b');
            await request(app)
                .post('/repository/commit')
                .send({ path: 'tmp', message: 'initial commit' })
                .expect(200);
            const commit = await repository.getHeadCommit();
            expect(commit.message()).to.equal('initial commit');
            const status = await repository.getStatus();
            expect(status.length).to.equal(0);
        });

        it('returns a 400 if one of the given fileUrls cannot be opened', async () => {
            fs.writeFileSync('tmp/a.txt', 'a');
            await request(app)
                .post('/repository/commit')
                .send({ path: 'tmp', message: 'initial commit', fileUrls: ['a.txt', 'nonexistent'] })
                .expect(400);
        });
    });
    describe('POST /repository/branch', () => {
        let repository;

        beforeEach(async () => {
            repository = await nodegit.Repository.init('tmp', 0);
            const defaultSignature = nodegit.Signature.default(repository);
            await repository.createCommitOnHead([], defaultSignature, defaultSignature, 'Initial commit');
        });

        it('creates the branch', async () => {
            await request(app)
                .post('/repository/branch')
                .send({ path: 'tmp', branch: 'newbranch' })
                .expect(200);
            const refs = await repository.getReferences(nodegit.Reference.TYPE.LISTALL);
            const refNames = refs.map(ref => ref.name());
            expect(refNames.indexOf('refs/heads/newbranch')).to.be.greaterThan(-1);
        });

        it('checks out the new branch', async () => {
            await request(app)
                .post('/repository/branch')
                .send({ path: 'tmp', branch: 'newbranch' })
                .expect(200);
            const reference = await repository.getCurrentBranch();
            expect(reference.name()).to.equal('refs/heads/newbranch');
        });

        it('works if the branch already exists', async () => {
            const headCommit = await repository.getHeadCommit();
            await repository.createBranch('existingbranch', headCommit);
            await request(app)
                .post('/repository/branch')
                .send({ path: 'tmp', branch: 'existingbranch' })
                .expect(200);
            const ref = await repository.getCurrentBranch();
            expect(ref.name()).to.equal('refs/heads/existingbranch');
        });
    });
});
