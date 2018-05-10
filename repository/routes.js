const bodyParser = require("body-parser");
const cors = require("cors");
const apiEndpoint = require("./api-endpoint.js");

module.exports = (app, git) => {
    app.use(bodyParser.json());
    app.use(cors());

    app.post("/clone", apiEndpoint(async (req, res, next) => {
        const body = req.body || {};
        const { repositoryUrl, directory } = body;
        if (!repositoryUrl) {
            res.status(400);
            return res.send({ error: "repositoryUrl is required" });
        }
        if (!directory) {
            res.status(400);
            return res.send({ error: "directory is required" });
        }
        await git.Clone(repositoryUrl, directory);
        res.send({});
    }));

    app.use((err, res) => {
        res.status(500);
        console.error(err);
        res.end(err.message);
    });
};
