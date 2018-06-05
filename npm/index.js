const express = require('express');
const routes = require('./routes');
const QioFS = require('q-io/fs');
const npm = require('npm');

const PACKAGE_HOME = process.env.PACKAGE_HOME || '/packages';

QioFS.exists(PACKAGE_HOME)
    .then((exists) => {
        if (!exists) {
            return QioFS.makeDirectory(PACKAGE_HOME)
                .then(() => {
                    console.log('Created nonexistent package home', PACKAGE_HOME);
                });
        }
    })
    .then(() => {
        const app = express();
        routes(app, npm, PACKAGE_HOME);
        console.log('Package will be stored at:', PACKAGE_HOME);
        app.listen(80);
        console.log('Listening on port 80');
    })
    .catch((err) => {
        console.error('ERROR while starting up. Exiting.', err);
        process.exit(1);
    });
