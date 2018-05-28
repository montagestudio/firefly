'use strict';

const bodyParser = require('body-parser');
const cors = require('cors');
const apiEndpoint = require("./api-endpoint");
const listDependencies = require("./list-dependencies");
const removePackage = require('./remove-package');
const npmView = require('./npm-view');
const path = require('path');

const NPM_PREFIX_HEADER = 'X-NPM-Prefix';

module.exports = (app, fs, npm, packageHome) => {
    app.use(bodyParser.json());
    app.use(cors());

    app.all("/dependencies/*", apiEndpoint((req, res, next) => {
        let prefix = req.headers[NPM_PREFIX_HEADER] || '';
        prefix = prefix.replace(/package\.json$/, '');
        return npm.load({
            prefix: path.join(packageHome, prefix),
            global: false
        }, (err, loadedNpm) => {
            if (err) {
                res.status(500).json(err);
            } else {
                req.npm = loadedNpm;
                next();
            }
        });
    }));

    app.get("/dependencies", apiEndpoint((req, res) => {
        let url = req.query.url || '';
        url = url.replace(/package\.json$/, '');
        return listDependencies(fs, url)
            .then((dependencyTree) => res.json(dependencyTree))
            .catch((error) => res.status(400).json(error));
    }));

    app.get("/dependencies/:dependency", apiEndpoint((req, res) => {
        return npmView(req.npm, req.params.dependency)
            .then(result => res.json(result))
            .catch((error) => res.status(400).json(error));
    }));

    app.delete("/dependencies/:dependency", apiEndpoint((req, res) => {
        return removePackage(fs, req.params.dependency, req.npm.prefix)
            .then((result) => res.json(result))
            .catch((error) => res.status(400).json(error));
    }));
};
