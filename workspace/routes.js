const bodyParser = require('body-parser');
const cors = require('cors');
const ApiError = require('./api-error');

module.exports = (app) => {
    app.use(bodyParser.json());
    app.use(cors());

    app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
        if (err instanceof ApiError) {
            res.status(err.status || 500).json(err);
        } else {
            // console.error(err);
            res.status(500).json(err);
        }
    });
};