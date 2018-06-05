const express = require('express');
const routes = require('./routes');

const app = express();

routes(app, process.env.WORKSPACE_HOME || '/workspaces');

app.listen(80);
console.log('Listening on port 80');
