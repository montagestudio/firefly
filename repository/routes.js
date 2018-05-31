const bodyParser = require("body-parser");
const cors = require("cors");
const ApiError = require('./api-error');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');

const readFileAsync = promisify(fs.readFile);
const existsAsync = promisify(fs.exists);

module.exports = (app, git) => {
    app.use(bodyParser.json());
    app.use(cors());

    app.get('/repository', async (req, res, next) => {
        const pathQuery = req.query.path;
        if (!pathQuery) {
            return next(new ApiError('path query is required', 400));
        }
        const gitExists = await existsAsync(path.join(pathQuery, '.git'));
        if (gitExists) {
            res.json({ exists: true });
        } else {
            res.status(404).json({ exists: false });
        }
    });

    app.post('/repository', async (req, res, next) => {
        const pathQuery = req.query.path;
        if (!pathQuery) {
            return next(new ApiError('path query is required', 400));
        }
        const body = req.body || {};
        const { repositoryUrl } = body;
        if (repositoryUrl) {
            try {
                await git.Clone(repositoryUrl, pathQuery);
                res.json({ cloned: true });
            } catch (err) {
                next(new ApiError('git repository could not be cloned: ' + err, 400));
            }
        } else {
            try {
                const r = await git.Repository.init(pathQuery, 0);
                res.json({ created: true });
            } catch (err) {
                next(err);
            }
        }
    });

    app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
        if (err instanceof ApiError) {
            res.status(err.status || 500).json(err);
        } else {
            // console.error(err);
            res.status(500).json(err);
        }
    });
};
