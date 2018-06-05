const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const ApiError = require('./api-error');

const readdirAsync = promisify(fs.readdir);

module.exports = (app, workspacesHome) => {
    app.use(bodyParser.json());
    app.use(cors());

    app.get('/workspaces', async (req, res) => {
        const { user } = req.query;
        const users = user ? [user] : await readdirAsync(workspacesHome);
        const workspaces = [];
        for (let usr of users) {
            const userPath = path.join(workspacesHome, usr);
            try {
                const owners = await readdirAsync(userPath);
                for (let owner of owners) {
                    const repos = await readdirAsync(path.join(userPath, owner));
                    for (let repo of repos) {
                        workspaces.push({ id: `${usr}/${owner}/${repo}` });
                    }
                }
            } catch (error) {
                continue;
            }
        }
        res.json(workspaces);
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