var URL = require("url");
var HTTP = require("q-io/http");

module.exports = proxyContainer;
function proxyContainer(request, projectWorkspaceUrl, route) {
    var proxiedPath = request.pathInfo.replace(/^\//, "");
    if (route === "static") { // TODO: hacky way to detect whether container id is in the path
        // remove the container id
        proxiedPath = request.pathInfo.replace(/^.+?\//, "");
    }
    request.url = URL.resolve("http://" + projectWorkspaceUrl + "/" + route + "/", proxiedPath);
    return HTTP.request(request);
}


