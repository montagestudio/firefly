var URL = require("url");
var HTTP = require("q-io/http");

module.exports = proxyContainer;
function proxyContainer(request, projectWorkspaceUrl, route) {
    request.url = URL.resolve("http://" + projectWorkspaceUrl + "/" + route + "/", request.pathInfo.replace(/^\//, ""));
    return HTTP.request(request);
}


