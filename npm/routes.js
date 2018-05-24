const bodyParser = require('body-parser');
const cors = require('cors');
const apiEndpoint = require("./api-endpoint");
const listDependencies = require("./list-dependencies");
const fs = require('fs');

module.exports = (app) => {
    app.use(bodyParser.json());
    app.use(cors());

    app.get("/dependencies", apiEndpoint(async (req, res) => {
        let { url } = req.query;
        if (!url) {
            res.status(400);
            return res.json({ error: "url query is required" });
        }

        url = url.replace(/package\.json$/, '');

        try {
            const dependencyTree = await listDependencies(fs, url);
            res.json(dependencyTree);
        } catch (error) {
            console.error(error);
            res.status(400).json({ error });
        }
    }));
};