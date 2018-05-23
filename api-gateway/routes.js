const bodyParser = require('body-parser');
const cors = require('cors');
const apiEndpoint = require('./api-endpoint');

module.exports = (app, request, getJwtProfile) => {
    app.use(bodyParser.json());

    const corsOptions = {
        origin: (origin, callback) => callback(null, true),
        credentials: true
    };
    app.use(cors(corsOptions));

    app.use(async (req, res, next) => {
        const accessToken = req.headers['x-access-token'];
        try {
            const info = await getJwtProfile(`Bearer ${accessToken}`);
            Object.assign(req, info);
            next();
        } catch (error) {
            res.status(401);
            if (error.response && error.response.status === 400) {
                res.json({ error: 'Unauthorized'});
            } else {
                console.error('Unexpected authorization error: ' + error);
                res.json({ error: 'Unexpected authorization error'});
            }
        }
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

    app.all('*', async(req, res) => {
        res.sendStatus(404);
    });

    app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
        console.error('Unexpected error: ', err);
        res.status(500);
        res.json({
            code: 500,
            error: 'Unexpected error'
        });
    });
};
