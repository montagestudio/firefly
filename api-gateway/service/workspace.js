const path = require('path');
const grpc = require('grpc');

const PROTO_PATH = path.join(__dirname, 'workspace.proto');

module.exports = () => {
    const proto = grpc.load(PROTO_PATH);
    return new proto.Workspace('workspace:8080', grpc.credentials.createInsecure());
};
