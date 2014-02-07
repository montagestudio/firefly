var log = require("logging").from(__filename);
var URL = require("url");
var HTTP = require("q-io/http");

module.exports = proxyApi;
function proxyApi(setupProjectContainer) {
    return setupProjectContainer(proxy);
}

function proxy(request) {
    request.url = URL.resolve("http://127.0.0.1:" + request.projectWorkspacePort + "/api/", request.pathInfo.replace(/^\//, ""));
    log("proxy", request.url);
    return HTTP.request(request);
}
