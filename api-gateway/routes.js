const bodyParser = require('body-parser');
const cors = require('cors');
const apiEndpoint = require('./api-endpoint');

module.exports = (app, request, getJwtProfile) => {
    app.use(bodyParser.json());
    app.use(cors());

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
        .get(apiEndpoint(async (req, res, next) => {
            let workspaces;
            try {
                workspaces = await request.get('http://project-daemon/workspaces');
            } catch (error) {
                workspaces = [];
            }
            res.json(workspaces);
        }))
        .delete(apiEndpoint(async (req, res, next) => {
            let response;
            try {
                response = await request.delete('http://project-daemon/workspaces');
            } catch (error) {
                response = { deleted: false };
            }
            res.json(response);
        }));

    app.all('/:owner/:repo/*', apiEndpoint(async (req, res, next) => {
        try {
            const response = await request[req.method.toLowerCase()].call(request, `http://project-daemon${req.path}`, req.body);
            res.json(response);
        } catch (error) {
            const { response } = error;
            if (response) {
                res.status(response.status);
                res.send(typeof response === 'object' ? response : { error: response });
            } else {
                throw error;
            }
        }
    }));

    app.all('/*', async(req, res, next) => {
        res.sendStatus(404);
    });

    app.use((err, req, res, next) => {
        console.error('Unexpected error: ' + err);
        res.status(500);
        res.json({
            code: 500,
            error: 'Unexpected error'
        });
    });
};
