const grpc = require('grpc');
const server = require('./server');

const WORKSPACE_HOME = process.env.WORKSPACE_HOME || '/workspaces';

server(WORKSPACE_HOME)
    .bind('0.0.0.0:8080', grpc.ServerCredentials.createInsecure())
    .start();
console.log('Listening for gRPC connections on port 8080');
