const express = require("express");
const supertest = require("supertest");
const chai = require("chai");
const { expect } = chai;
const spies = require("chai-spies");
const routes = require("../routes");
const axios = require('axios');
const jwt = require('../middleware/jwt');
const { request: jwtRequest } = require('./mocks/jwt-request-mock');

chai.use(spies);

function fakeAxiosData(method, data) {
    chai.spy.on(axios, method, async () => ({
        status: 200,
        data
    }));
}

describe('api', () => {
    let app;

    const authenticated = (method, url) => supertest(app)[method](url).set('x-access-token', 'abc');

    beforeEach(() => {
        app = express();
        routes(app, axios, jwt(jwtRequest));
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
        authenticated('get', '/doesntexist')
            .expect(404, done);
    });

    describe('GET /workspaces', () => {
        it('proxies workspace\'s workspace endpoint', (done) => {
            fakeAxiosData('get', []);
            authenticated('get', '/workspaces')
                .expect(200)
                .expect([])
                .end((err) => {
                    if (err) return done(err);
                    expect(axios.get).to.have.been.called.with('http://workspace/workspaces?user=mocha');
                    done();
                });
        });

        it('returns an empty array if the project-daemon service cannot be reached', (done) => {
            chai.spy.on(axios, 'get', async () => {
                throw new Error('chaos');
            });
            authenticated('get', '/workspaces')
                .expect(200)
                .expect([], done);
        });
    });

    describe('DELETE /workspaces', () => {
        it('proxies workspace\'s workspace endpoint', (done) => {
            const fakeResponse = { foo: 'bar' };
            fakeAxiosData('delete', fakeResponse);
            authenticated('delete', '/workspaces')
                .expect(200)
                .expect(fakeResponse)
                .end((err) => {
                    if (err) return done(err);
                    expect(axios.delete).to.have.been.called.with('http://workspace/workspaces?user=mocha');
                    done();
                });
        });

        it('returns {deleted: false} if the operation failed', (done) => {
            chai.spy.on(axios, 'delete', async () => {
                throw new Error('chaos');
            });
            authenticated('delete', '/workspaces')
                .expect(200)
                .expect({ deleted: false }, done);
        });
    });

    describe('POST /{owner}/{repo}/init', () => {
    });

    describe('POST /{owner}/{repo}/flush', () => {
        it('proxies project-daemon\'s flush endpoint', (done) => {
            const fakeResponse = { message: 'flushed' };
            fakeAxiosData('post', fakeResponse);
            const body = { 'message': 'foo' };
            authenticated('post', '/owner/repo/flush')
                .send(body)
                .expect(200)
                .expect(fakeResponse)
                .end((err) => {
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
            authenticated('get', '/owner/repo/workspace')
                .expect(200)
                .expect(fakeResponse)
                .end((err) => {
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
            authenticated('post', '/owner/repo/save')
                .send(body)
                .expect(200)
                .expect(fakeResponse)
                .end((err) => {
                    if (err) return done(err);
                    expect(axios.post).to.have.been.called.with('http://firefly_project-daemon:2440/owner/repo/save', body);
                    done();
                });
        });
    });

    describe('POST /{owner}/{repo}/components', () => {
        it('proxies minit\'s components endpoint', (done) => {
            const fakeResponse = { created: true };
            fakeAxiosData('post', fakeResponse);
            const body = { name: 'foo' };
            authenticated('post', '/owner/repo/components')
                .send(body)
                .expect(200)
                .expect(fakeResponse)
                .end((err) => {
                    if (err) return done(err);
                    expect(axios.post).to.have.been.called.with(`http://minit/components/foo?path=${encodeURIComponent('mocha/owner/repo')}`);
                    done();
                });
        });
    });

    describe('POST /{owner}/{repo}/modules', () => {
        it('proxies minit\'s modules endpoint', (done) => {
            const fakeResponse = { created: true };
            fakeAxiosData('post', fakeResponse);
            const body = { name: 'foo', extendsModuleId: 'bar', extendsName: 'Bar' };
            authenticated('post', '/owner/repo/modules')
                .send(body)
                .expect(200)
                .expect(fakeResponse)
                .end((err) => {
                    if (err) return done(err);
                    expect(axios.post).to.have.been.called.with(`http://minit/modules/foo?path=${encodeURIComponent('mocha/owner/repo')}`);
                    done();
                });
        });
    });
});
