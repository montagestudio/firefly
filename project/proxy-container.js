var URL = require("url");
var HTTP = require("q-io/http");

module.exports = proxyContainer;
function proxyContainer(request, projectWorkspacePort, route) {
    request.url = URL.resolve("http://127.0.0.1:" + projectWorkspacePort + "/" + route + "/", request.pathInfo.replace(/^\//, ""));
    return HTTP.request(request);
}


