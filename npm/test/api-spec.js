'use strict';

const express = require('express');
const supertest = require('supertest');
const expect = require('chai').expect;
const routes = require('../routes');
const QioFS = require('q-io/fs');
const npm = require('npm');

describe('api', () => {
    let app;

    beforeEach((done) => {
        app = express();
        QioFS.copyTree('test/fixtures', 'tmp')
            .then(() => {
                routes(app, npm, 'tmp');
                done();
            })
            .catch(done);
    });

    afterEach((done) => {
        QioFS.removeTree('tmp')
            .then(() => done(), done);
    });

    describe('POST /package/install', () => {
        it('installs dependencies', (done) => {
            supertest(app)
                .post('/package/install')
                .send({ prefix: 'not-installed' })
                .expect(200)
                .end((err) => {
                    if (err) return done(err);
                    QioFS.exists('tmp/not-installed/node_modules/minit')
                        .then(exists => expect(exists).to.equal(true))
                        .then(() => done())
                        .catch(done);
                });
        }).timeout(20000);
    });
});
