const grpc = require('grpc');
const makeServer = require('./server');

const WORKSPACE_HOME = process.env.WORKSPACE_HOME || '/workspaces';

const server = makeServer(WORKSPACE_HOME);
server.bind('0.0.0.0:8080', grpc.ServerCredentials.createInsecure());
server.start();
console.log('Listening for gRPC connections on port 8080');
