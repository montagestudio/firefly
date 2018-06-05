'use strict';

const bodyParser = require('body-parser');
const cors = require('cors');
const apiEndpoint = require('./api-endpoint');
const listDependencies = require('./list-dependencies');
const removePackage = require('./remove-package');
const npmView = require('./npm-view');
const path = require('path');
const QioFS = require('q-io/fs');

module.exports = (app, npm, packageHome) => {
    app.use(bodyParser.json());
    app.use(cors());

    app.all('/package/*', apiEndpoint((req, res, next) => {
        let prefix;
        if (req.method.toLowerCase() === 'get') {
            prefix = req.query.prefix;
        } else {
            prefix = req.body && req.body.prefix;
        }
        if (!prefix) {
            return next(new Error('prefix is required'));
        }
        prefix = prefix.replace(/package\.json$/, '');
        const absolutePath = path.join(packageHome, prefix);
        const fsPromise = QioFS.reroot(absolutePath);
        const npmPromise = new Promise((resolve, reject) => {
            npm.load({
                prefix: absolutePath,
                global: false
            }, (err, loadedNpm) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(loadedNpm);
                }
            });
        });
        Promise.all([fsPromise, npmPromise])
            .then((results) => {
                const fs = results[0];
                const npm = results[1];
                res.locals.fs = fs;
                res.locals.npm = npm;
                next();
            })
            .catch((err) => {
                res.status(400).json(err);
            });
    }));

    app.get('/package/dependencies', apiEndpoint((req, res) => {
        let url = req.query.url || './';
        url = url.replace(/package\.json$/, '');
        return listDependencies(res.locals.fs, url)
            .then((dependencyTree) => res.json(dependencyTree))
            .catch((error) => res.status(400).json(error));
    }));

    app.get('/package/dependencies/:dependency', apiEndpoint((req, res) => {
        return npmView(res.locals.npm, req.params.dependency)
            .then(result => res.json(result))
            .catch((error) => res.status(400).json(error));
    }));

    app.delete('/package/dependencies/:dependency', apiEndpoint((req, res) => {
        return removePackage(res.locals.fs, req.params.dependency, req.body && req.body.location || './node_modules')
            .then((result) => res.json(result))
            .catch((error) => res.status(400).json(error));
    }));
};
