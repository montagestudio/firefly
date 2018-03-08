var URL = require("url");
var HTTP = require("q-io/http");

module.exports = proxyContainer;
function proxyContainer(request, projectWorkspacePort, route) {
    var proxiedPath = request.pathInfo.replace(/^\//, "");
    if (route === "static") { // TODO: hacky way to detect whether container id is in the path
        // remove the container id
        proxiedPath = request.pathInfo.replace(/^.+?\//, "");
    }
    request.url = URL.resolve("http://127.0.0.1:" + projectWorkspacePort + "/" + route + "/", proxiedPath);
    return HTTP.request(request);
}


