const express = require("express");
const supertest = require("supertest");
const chai = require("chai");
const { expect } = chai;
const spies = require("chai-spies");
const routes = require("../routes");
const URL = require('url');
const axios = require('axios');

chai.use(spies);

async function getJwtProfile(authHeader) {
    if (authHeader) {
        const [ bearer, token ] = authHeader.split(' ');
        if (bearer === 'Bearer' && token === 'abc') {
            return { profile: {}, token: 'abc' };
        }
    }
    throw { response: { status: 400 } };
}

function fakeAxiosData(method, data) {
    chai.spy.on(axios, method, async (url) => ({
        status: 200,
        data
    }));
}

describe('api', () => {
    let app, sandbox;

    beforeEach(() => {
        app = express();
        routes(app, axios, getJwtProfile);
    });

    afterEach(() => {
        chai.spy.restore();
    });

    it('responds with 401 when no authentication is provided', (done) => {
        supertest(app)
            .get('/workspaces')
            .expect(401, done);
    });

    it('responds with 404 for a non-existent route', (done) => {
        supertest(app)
            .get('/doesntexist')
            .set('x-access-token', 'abc')
            .expect(404, done);
    });

    describe('GET /workspaces', () => {
        it('proxies project-daemon\'s workspace endpoint', (done) => {
            fakeAxiosData('get', []);
            supertest(app)
                .get('/workspaces')
                .set('x-access-token', 'abc')
                .expect(200)
                .expect([])
                .end((err, res) => {
                    if (err) return done(err);
                    expect(axios.get).to.have.been.called.with('http://firefly_project-daemon:2440/workspaces');
                    done();
                });
        });

        it('returns an empty array if the project-daemon service cannot be reached', (done) => {
            chai.spy.on(axios, 'get', async (url) => {
                throw new Error('chaos');
            });
            supertest(app)
                .get('/workspaces')
                .set('x-access-token', 'abc')
                .expect(200)
                .expect([], done);
        });
    });

    describe('DELETE /workspaces', () => {
        it('proxies project-daemon\'s workspace endpoint', (done) => {
            const fakeResponse = { foo: 'bar' };
            fakeAxiosData('delete', fakeResponse);
            supertest(app)
                .delete('/workspaces')
                .set('x-access-token', 'abc')
                .expect(200)
                .expect(fakeResponse)
                .end((err, res) => {
                    if (err) return done(err);
                    expect(axios.delete).to.have.been.called.with('http://firefly_project-daemon:2440/workspaces');
                    done();
                });
        });

        it('returns {deleted: false} if the operation failed', (done) => {
            chai.spy.on(axios, 'delete', async (url) => {
                throw new Error('chaos');
            });
            supertest(app)
                .delete('/workspaces')
                .set('x-access-token', 'abc')
                .expect(200)
                .expect({ deleted: false }, done);
        });
    });

    describe('POST /{owner}/{repo}/init', () => {
        it('proxies project-daemon\'s init endpoint', (done) => {
            const fakeResponse = { message: 'created' };
            fakeAxiosData('post', fakeResponse);
            supertest(app)
                .post('/owner/repo/init')
                .set('x-access-token', 'abc')
                .expect(200)
                .expect(fakeResponse)
                .end((err, res) => {
                    if (err) return done(err);
                    expect(axios.post).to.have.been.called.with('http://firefly_project-daemon:2440/owner/repo/init');
                    done();
                });
        });
    });

    describe('GET /{owner}/{repo}/init/progress', () => {
        it('proxies project-daemon\'s init/progress endpoint', (done) => {
            const fakeResponse = { state: 'installing' };
            fakeAxiosData('get', fakeResponse);
            supertest(app)
                .get('/owner/repo/init/progress')
                .set('x-access-token', 'abc')
                .expect(200)
                .expect(fakeResponse)
                .end((err, res) => {
                    if (err) return done(err);
                    expect(axios.get).to.have.been.called.with('http://firefly_project-daemon:2440/owner/repo/init/progress');
                    done();
                });
        });
    });

    describe('POST /{owner}/{repo}/flush', () => {
        it('proxies project-daemon\'s flush endpoint', (done) => {
            const fakeResponse = { message: 'flushed' };
            fakeAxiosData('post', fakeResponse);
            const body = { 'message': 'foo' };
            supertest(app)
                .post('/owner/repo/flush')
                .send(body)
                .set('x-access-token', 'abc')
                .expect(200)
                .expect(fakeResponse)
                .end((err, res) => {
                    if (err) return done(err);
                    expect(axios.post).to.have.been.called.with('http://firefly_project-daemon:2440/owner/repo/flush', body);
                    done();
                });
        });
    });

    describe('GET /{owner}/{repo}/workspace', () => {
        it('proxies project-daemon\'s workspace endpoint', (done) => {
            const fakeResponse = { created: 'yes' };
            fakeAxiosData('get', fakeResponse);
            supertest(app)
                .get('/owner/repo/workspace')
                .set('x-access-token', 'abc')
                .expect(200)
                .expect(fakeResponse)
                .end((err, res) => {
                    if (err) return done(err);
                    expect(axios.get).to.have.been.called.with('http://firefly_project-daemon:2440/owner/repo/workspace');
                    done();
                });
        });
    });

    describe('POST /{owner}/{repo}/save', () => {
        it('proxies project-daemon\'s flush endpoint', (done) => {
            const fakeResponse = { message: 'saved' };
            fakeAxiosData('post', fakeResponse);
            const body = { filename: 'foo.js', content: 'bar' };
            supertest(app)
                .post('/owner/repo/save')
                .send(body)
                .set('x-access-token', 'abc')
                .expect(200)
                .expect(fakeResponse)
                .end((err, res) => {
                    if (err) return done(err);
                    expect(axios.post).to.have.been.called.with('http://firefly_project-daemon:2440/owner/repo/save', body);
                    done();
                });
        });
    });

    describe('POST /{owner}/{repo}/components', () => {
        it('proxies project-daemon\'s components endpoint', (done) => {
            const fakeResponse = { success: true, message: 'created' };
            fakeAxiosData('post', fakeResponse);
            const body = { name: 'foo', destination: './' };
            supertest(app)
                .post('/owner/repo/components')
                .send(body)
                .set('x-access-token', 'abc')
                .expect(200)
                .expect(fakeResponse)
                .end((err, res) => {
                    if (err) return done(err);
                    expect(axios.post).to.have.been.called.with('http://firefly_project-daemon:2440/owner/repo/components', body);
                    done();
                });
        });
    });

    describe('POST /{owner}/{repo}/modules', () => {
        it('proxies project-daemon\'s modules endpoint', (done) => {
            const fakeResponse = { success: true, message: 'created' };
            fakeAxiosData('post', fakeResponse);
            const body = { name: 'foo', extendsModuleId: 'bar', extendsName: 'Bar', destination: './' };
            supertest(app)
                .post('/owner/repo/modules')
                .send(body)
                .set('x-access-token', 'abc')
                .expect(200)
                .expect(fakeResponse)
                .end((err, res) => {
                    if (err) return done(err);
                    expect(axios.post).to.have.been.called.with('http://firefly_project-daemon:2440/owner/repo/modules', body);
                    done();
                });
        });
    });
});
