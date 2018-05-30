const bodyParser = require("body-parser");
const cors = require("cors");
const ApiError = require('./api-error');

module.exports = (app, git) => {
    app.use(bodyParser.json());
    app.use(cors());

    app.post("/clone", async (req, res, next) => {
        const body = req.body || {};
        const { repositoryUrl, directory } = body;
        if (!repositoryUrl) {
            return next(new ApiError('repositoryUrl is required', 400));
        }
        if (!directory) {
            return next(new ApiError('directory is required', 400));
        }
        try {
            await git.Clone(repositoryUrl, directory);
            res.send({ cloned: true });
        } catch (err) {
            next(err);
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
