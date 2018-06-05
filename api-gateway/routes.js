const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const ApiError = require('./api-error');
const WorkspaceApi = require('./service/workspace-api');
const GithubApi = require('./github-api');
const RepositoryApi = require('./service/repository-api');
const MinitApi = require('./service/minit-api');
const NpmApi = require('./service/npm-api');

module.exports = (app, request, jwtMiddleware) => {
    app.use(bodyParser.json());

    const corsOptions = {
        origin: (origin, callback) => callback(null, true),
        credentials: true
    };
    app.use(cors(corsOptions));

    app.use(jwtMiddleware);

    const workspaceApi = new WorkspaceApi(request);
    const repositoryApi = new RepositoryApi(request);
    const minitApi = new MinitApi(request);
    const npmApi = new NpmApi(request);

    app.route('/workspaces')
        .get(async (req, res) => {
            try {
                res.json(await workspaceApi.listWorkspaces(res.locals.profile.username));
            } catch (error) {
                res.json([]);
            }
        })
        .delete(async (req, res) => {
            try {
                res.json(await workspaceApi.deleteWorkspaces(res.locals.profile.username));
            } catch (error) {
                res.json({ deleted: false });
            }
        });

    app.all('/:owner/:repo/*', async (req, res, next) => {
        const workspacePath = path.join(res.locals.profile.username, req.params.owner, req.params.repo);
        res.locals.workspacePath = workspacePath;
        next();
    });

    app.post('/:owner/:repo/init', async (req, res, next) => {
        const { workspacePath } = res.locals;
        if (await repositoryApi.repositoryExists(workspacePath)) {
            return res.json({ message: 'initializing' });
        }
        const githubApi = new GithubApi(res.locals.token);
        let isEmpty;
        try {
            isEmpty = await githubApi.isRepositoryEmpty(req.params.owner, req.params.repo);
        } catch (error) {
            next(new ApiError('github service failure'));
        }
        try {
            const remoteUrl = `https://github.com/${req.params.owner}/${req.params.repo}`;
            const { name, email } = res.locals.profile;
            if (isEmpty) {
                await minitApi.createApp(workspacePath, req.params.repo);
                await repositoryApi.createRepository(workspacePath, remoteUrl, res.locals.token, name, email);
                await repositoryApi.commitAll(workspacePath, 'Initial commit');
            } else {
                await repositoryApi.cloneRepository(workspacePath, remoteUrl, res.locals.token, name, email);
            }
            await npmApi.installDependencies(workspacePath);
            let response;
            if (isEmpty) {
                response = await request.post(`/${req.params.owner}/${req.params.repo}/init_empty`, {}, {
                    headers: {
                        common: {
                            'x-access-token': req.headers['x-access-token']
                        }
                    }
                });
            } else {
                response = await request.post(`/${req.params.owner}/${req.params.repo}/init_repository`, {}, {
                    headers: {
                        common: {
                            'x-access-token': req.headers['x-access-token']
                        }
                    }
                });
            }
            res.json(response.data);
        } catch (error) {
            next(error);
        }
    });

    app.post('/:owner/:repo/components', async (req, res, next) => {
        let { name, destination } = req.body;
        destination = destination || '';
        if (!name) {
            return next(new ApiError('name is required in the body', 400));
        }
        const fullPath = path.join(res.locals.workspacePath, destination);
        try {
            const response = await request.post(`http://minit/components/${name}?path=${encodeURIComponent(fullPath)}`);
            res.json(response.data);
        } catch (error) {
            const { response } = error;
            if (response) {
                const { status, data } = response;
                res.status(status).json(data);
            } else {
                next(error);
            }
        }
    });

    app.post('/:owner/:repo/modules', async (req, res, next) => {
        let { name, destination } = req.body;
        destination = destination || '';
        if (!name) {
            return next(new ApiError('name is required in the body', 400));
        }
        const fullPath = path.join(res.locals.workspacePath, destination);
        try {
            const response = await request.post(`http://minit/modules/${name}?path=${encodeURIComponent(fullPath)}`);
            res.json(response.data);
        } catch (error) {
            const { response } = error;
            if (response) {
                const { status, data } = response;
                res.status(status).json(data);
            } else {
                next(error);
            }
        }
    });

    app.all('/:owner/:repo/*', async (req, res, next) => {
        try {
            const axiosConfig = {
                headers: {
                    common: req.headers
                }
            };
            const method = req.method.toLowerCase();
            const projectDaemonUrl = `http://firefly_project-daemon:2440${req.path}`;
            let response;
            if (method === 'post') {
                response = await request.post(projectDaemonUrl, req.body, axiosConfig);
            } else {
                response = await request[method].call(request, projectDaemonUrl, axiosConfig);
            }
            res.json(response.data);
        } catch (error) {
            const { response } = error;
            if (response) {
                const { status, data } = response;
                res.status(status);
                res.json(typeof data === 'object' ? data : { error: data });
            } else {
                next(error);
            }
        }
    });

    app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
        if (err instanceof ApiError) {
            res.status(err.statusCode || 500).json(err);
        } else {
            console.error("Unhandled error:", err);
            res.status(500).json({
                error: "Unexpected internal server error"
            });
        }
    });
};
