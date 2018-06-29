const express = require("express");
const grpc = require('grpc');
const axios = require('axios');
const routes = require('./routes');
const jwt = require('./middleware/jwt');

const PROTO_PATH = 'workspace.proto';

const app = express();

const axiosInstance = axios.create({
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    }
});

const workspaceService = grpc.load(PROTO_PATH);
const workspaceClient = new workspaceService.Workspace('workspace:8080', grpc.credentials.createInsecure());

routes(app, axiosInstance, jwt(axiosInstance), workspaceClient);

app.listen(80);
console.log("Listening on port 80");
