const express = require('express');
const routes = require('./routes');

process.env.WORKSPACE_HOME = process.env.WORKSPACE_HOME || '/workspaces';

const app = express();

routes(app);

app.listen(80);
console.log('Listening on port 80');
