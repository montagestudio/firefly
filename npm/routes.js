const bodyParser = require('body-parser');
const cors = require('cors');
const apiEndpoint = require("./api-endpoint.js");

module.exports = (app) => {
    app.use(bodyParser.json());
    app.use(cors());
};