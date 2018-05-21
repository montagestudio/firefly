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
            chai.spy.on(axios, 'get', async (url) => []);
            supertest(app)
                .get('/workspaces')
                .set('x-access-token', 'abc')
                .expect(200)
                .expect([])
                .end((err, res) => {
                    if (err) return done(err);
                    expect(axios.get).to.have.been.called.with('http://project-daemon/workspaces');
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
            chai.spy.on(axios, 'delete', async (url) => fakeResponse);
            supertest(app)
                .delete('/workspaces')
                .set('x-access-token', 'abc')
                .expect(200)
                .expect(fakeResponse)
                .end((err, res) => {
                    if (err) return done(err);
                    expect(axios.delete).to.have.been.called.with('http://project-daemon/workspaces');
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
});
