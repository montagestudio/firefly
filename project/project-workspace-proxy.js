var log = require("logging").from(__filename);
var request = require("q-io/http").request;

module.exports = ProjectWorkspaceProxy;
function ProjectWorkspaceProxy(port) {
    log("ProjectWorkspaceProxy port", port);
    this.port = port;
}

ProjectWorkspaceProxy.prototype.existsWorkspace = function() {
    log("existsWorkspace");
    return request({
        host: "localhost",
        port: this.port,
        method: "GET",
        path: "/workspace"
    }).then(function (response) {
        return response.body.read();
    })
    .then(function (body) {
        return JSON.parse(body.toString("utf8")).created;
    });
};
