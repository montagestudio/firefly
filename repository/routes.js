const bodyParser = require("body-parser");
const cors = require("cors");
const ApiError = require('./api-error');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');

const readFileAsync = promisify(fs.readFile);
const existsAsync = promisify(fs.exists);

const sshPublicKeyPath = path.join(__dirname, 'ssl', 'id_rsa.pub');
const sshPrivateKeyPath = path.join(__dirname, 'ssl', 'id_rsa');

const REPOSITORY_HOME = process.env.REPOSITORY_HOME || '';

module.exports = (app, git) => {
    app.use(bodyParser.json());
    app.use(cors());

    const authenticationCallbacks = {
        certificateCheck: () => 1,
        credentials: (url, username) => {
            return git.Cred.sshKeyNew(username, sshPublicKeyPath, sshPrivateKeyPath, '');
        }
    };

    app.get('/repository', async (req, res, next) => {
        const pathQuery = req.query.path;
        if (!pathQuery) {
            return next(new ApiError('path query is required', 400));
        }
        const absolutePath = path.join(REPOSITORY_HOME, pathQuery);
        const gitExists = await existsAsync(path.join(pathQuery, '.git'));
        if (gitExists) {
            res.json({ exists: true });
        } else {
            res.status(404).json({ exists: false });
        }
    });

    app.post('/repository', async (req, res, next) => {
        const body = req.body || {};
        const {
            repositoryUrl,
            remoteUrl,
            name,
            email
        } = body;
        const githubAccessToken = req.headers['x-github-access-token'];
        if (!repositoryUrl && !body.path) { return next(new ApiError('path is required when initializing a new repository', 400)); }
        const directory = path.join(REPOSITORY_HOME, body.path || '');
        let repository;
        if (repositoryUrl) {
            try {
                repository = await git.Clone(repositoryUrl, directory, {
                    fetchOpts: {
                        callbacks: {
                            credentials: () => git.Cred.userpassPlaintextNew(githubAccessToken, 'x-oauth-basic'),
                            certificateCheck: () => 1
                        }
                    }
                });
            } catch (err) {
                return next(new ApiError('git repository could not be cloned: ' + err, 400));
            }
        } else {
            try {
                repository = await git.Repository.init(directory, 0);
                if (remoteUrl) {
                    await git.Remote.create(repository, 'origin', remoteUrl);
                }
            } catch (err) {
                return next(err);
            }
        }
        if (name || email) {
            try {
                const config = await repository.config();
                await config.setString('user.name', name);
                await config.setString('user.email', email);
            } catch (err) {
                return next(new ApiError('failed configuring repository', 500));
            }
        }
        res.json({ cloned: true });
    });

    app.post('/repository/*', async (req, res, next) => {
        const { path: directory } = req.body || {};
        if (directory) {
            res.locals.directory = path.join(REPOSITORY_HOME, directory);
            try {
                res.locals.repo = await git.Repository.open(directory);
                next();
            } catch (error) {
                next(new ApiError('unable to open repository', 400));
            }
        } else {
            next(new ApiError('path is required', 400));
        }
    });

    app.post('/repository/commit', async (req, res, next) => {
        const { repo } = res.locals;
        let {
            fileUrls,
            message
        } = req.body || {};
        if (!message) return next(new ApiError('message is required', 400));
        const defaultSignature = git.Signature.default(repo);
        if (!fileUrls) {
            const statusFiles = await repo.getStatus();
            fileUrls = statusFiles.map((file) => file.path());
        }
        try {
            const oid = await repo.createCommitOnHead(fileUrls, defaultSignature, defaultSignature, message);
            res.json({ oid });
        } catch (error) {
            return next(new ApiError('commit failed', 400));
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
