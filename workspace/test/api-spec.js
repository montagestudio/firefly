const express = require('express');
const rimraf = require('rimraf');
const supertest = require('supertest');
const { expect } = require('chai');
const fs = require('fs');
const path = require('path');
const routes = require('../routes');

function makeFakeWorkspaces(base, tree) {
    Object.keys(tree).forEach((user) => {
        fs.mkdirSync(path.join(base, user));
        Object.keys(tree[user]).forEach((owner) => {
            fs.mkdirSync(path.join(base, user, owner));
            Object.keys(tree[user][owner]).forEach((repo) => {
                fs.mkdirSync(path.join(base, user, owner, repo));
            });
        });
    });
}

function mapTreeToContainers(tree) {
    const containers = [];
    Object.keys(tree).forEach((user) => {
        Object.keys(tree[user]).forEach((owner) => {
            Object.keys(tree[user][owner]).forEach((repo) => {
                containers.push({ id: `${user}/${owner}/${repo}`});
            });
        });
    });
    return containers;
}

describe('api', () => {
    let app;

    beforeEach(() => {
        app = express();
        fs.mkdirSync('tmp');
        routes(app, 'tmp');
    });

    afterEach((done) => {
        rimraf('tmp', e => done(e));
    });

    describe('GET /workspaces', () => {
        let tree;

        beforeEach(() => {
            tree = {
                'user1': {
                    'owner1': {
                        'repo1': {},
                        'repo2': {}
                    },
                    'owner2': {
                        'repo1': {}
                    }
                },
                'user2': {
                    'owner1': {
                        'repo1': {}
                    }
                }
            };
            makeFakeWorkspaces('tmp', tree);
        });

        it('returns all workspaces', (done) => {
            const expected = mapTreeToContainers(tree);
            supertest(app)
                .get('/workspaces')
                .expect(200)
                .expect(expected, done);
        });

        it('returns a specific user\'s workspaces', (done) => {
            const expected = mapTreeToContainers(tree);
            expected.splice(expected.length - 1);
            supertest(app)
                .get('/workspaces?user=user1')
                .expect(200)
                .expect(expected, done);
        });

        it('returns an empty array for a nonexistent user', (done) => {
            supertest(app)
                .get('/workspaces?user=user3')
                .expect(200)
                .expect([], done);
        });
    });

    describe('DELETE /workspaces', () => {
        let tree;

        beforeEach(() => {
            tree = {
                'user1': {
                    'owner1': {
                        'repo1': {},
                        'repo2': {}
                    },
                    'owner2': {
                        'repo1': {}
                    }
                },
                'user2': {
                    'owner1': {
                        'repo1': {}
                    }
                }
            };
            makeFakeWorkspaces('tmp', tree);
        });

        it('deletes all workspaces', (done) => {
            supertest(app)
                .delete('/workspaces')
                .expect(200)
                .end((err) => {
                    if (err) return done(err);
                    const users = fs.readdirSync('tmp');
                    expect(users.length).to.equal(0);
                    done();
                });
        });

        it('deletes a specific user\'s workspaces', (done) => {
            supertest(app)
                .delete('/workspaces?user=user1')
                .expect(200)
                .end((err) => {
                    if (err) return done(err);
                    const users = fs.readdirSync('tmp');
                    expect(users.length).to.equal(1);
                    expect(users[0]).to.equal('user2');
                    done();
                });
        });

        it('does nothing if the user has no repos', (done) => {
            supertest(app)
                .delete('/workspaces?user=user3')
                .expect(200)
                .end((err) => {
                    if (err) return done(err);
                    const users = fs.readdirSync('tmp');
                    expect(users.length).to.equal(2);
                    done();
                });
        });
    });
});
