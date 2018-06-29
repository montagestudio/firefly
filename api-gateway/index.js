const express = require("express");
const axios = require('axios');
const routes = require('./routes');
const jwt = require('./middleware/jwt');
const makeWorkspaceService = require('./service/workspace');

const app = express();

const axiosInstance = axios.create({
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    }
});

const workspaceService = makeWorkspaceService();

routes(app, axiosInstance, jwt(axiosInstance), workspaceService);

app.listen(80);
console.log("Listening on port 80");
