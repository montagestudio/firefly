'use strict';

const bodyParser = require('body-parser');
const cors = require('cors');
const apiEndpoint = require("./api-endpoint");
const listDependencies = require("./list-dependencies");
const fs = require('q-io/fs');

module.exports = (app) => {
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
                res.status(400).json({ error });
            });
    }));
};