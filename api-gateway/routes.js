const bodyParser = require('body-parser');
const cors = require('cors');

module.exports = (app) => {
    app.use(bodyParser());
    app.use(cors());
};
