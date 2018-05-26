'use strict';

const bodyParser = require('body-parser');
const cors = require('cors');
const apiEndpoint = require("./api-endpoint");
const listDependencies = require("./list-dependencies");
const removePackage = require('./remove-package');

module.exports = (app, fs) => {
    app.use(bodyParser.json());
    app.use(cors());

    app.get("/dependencies", apiEndpoint((req, res) => {
        let url = req.query.url;
        if (!url) {
            res.status(400);
            return res.json({ error: "url query is required" });
        }

        url = url.replace(/package\.json$/, '');

        return listDependencies(fs, url)
            .then(function (dependencyTree) {
                res.json(dependencyTree);
            })
            .catch(function (error) {
                console.error(error);
                res.status(400).json(error);
            });
    }));

    app.delete("/dependencies/:dependency", apiEndpoint((req, res) => {
        let url = req.query.location;
        if (!url) {
            res.status(400);
            return res.json({ error: "location query is required" });
        }
        return removePackage(fs, req.params.dependency, url)
            .then(function (result) {
                res.json(result);
            })
            .catch(function (error) {
                res.status(400).json(error);
            });
    }));
};
