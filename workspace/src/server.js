const grpc = require('grpc');
const path = require('path');
const service = require('./service');

const PROTO_PATH = path.join(__dirname, 'service.proto');
const proto = grpc.load(PROTO_PATH);

module.exports = (workspaceHome) => {
    const server = new grpc.Server();
    server.addService(proto.Workspace.service, service(workspaceHome));
    return server;
}

module.exports.proto = proto;
