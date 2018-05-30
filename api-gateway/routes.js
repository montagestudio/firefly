const bodyParser = require('body-parser');
const cors = require('cors');
const ApiError = require('./api-error');
const apiEndpoint = require('./api-endpoint');

module.exports = (app, request, jwtMiddleware) => {
    app.use(bodyParser.json());

    const corsOptions = {
        origin: (origin, callback) => callback(null, true),
        credentials: true
    };
    app.use(cors(corsOptions));

    app.use(jwtMiddleware);

    app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
        res.status(err instanceof ApiError ? err.statusCode : 500).json(err);
    });

    app.route('/workspaces')
        .get(apiEndpoint(async (req, res) => {
            try {
                const response = await request.get('http://firefly_project-daemon:2440/workspaces', {
                    headers: {
                        common: {
                            'x-access-token': req.headers['x-access-token']
                        }
                    }
                });
                res.json(response.data);
            } catch (error) {
                res.json([]);
            }
        }))
        .delete(apiEndpoint(async (req, res) => {
            try {
                const response = await request.delete('http://firefly_project-daemon:2440/workspaces', {
                    headers: {
                        common: {
                            'x-access-token': req.headers['x-access-token']
                        }
                    }
                });
                res.json(response.data);
            } catch (error) {
                res.json({ deleted: false });
            }
        }));

    app.all('/:owner/:repo/*', apiEndpoint(async (req, res) => {
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
                throw error;
            }
        }
    }));
};
