var URL = require("url");
var HTTP = require("q-io/http");

module.exports = proxyContainer;
function proxyContainer(request, port, route) {
    request.url = URL.resolve("http://127.0.0.1:" + port + "/" + route + "/", request.pathInfo.replace(/^\//, ""));
    return HTTP.request(request);
}
