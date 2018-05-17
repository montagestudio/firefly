const express = require("express");
const request = require("supertest");
const chai = require("chai");
const routes = require("../routes");

async function fakeRequest() {
    return {};
}

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
    beforeEach(() => {
        app = express();
        routes(app, fakeRequest, getJwtProfile);
    });

    it('responds with 401 when no authentication is provided', (done) => {
        request(app)
            .get('/workspaces')
            .expect(401)
            .end(done);
    });

    it('responds with 404 for a non-existent route', (done) => {
        request(app)
            .get('/doesntexist')
            .set('x-access-token', 'abc')
            .expect(404)
            .end(done);
    });

    describe('GET /workspaces', () => {
    });
});