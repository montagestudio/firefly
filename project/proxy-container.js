var URL = require("url");
var HTTP = require("q-io/http");

module.exports = ProxyContainer;
function ProxyContainer(setupProjectContainer, route) {
    function proxy(request) {
        request.url = URL.resolve("http://127.0.0.1:" + request.projectWorkspacePort + "/" + route + "/", request.pathInfo.replace(/^\//, ""));
        return HTTP.request(request);
    }

    return setupProjectContainer(proxy);
}


