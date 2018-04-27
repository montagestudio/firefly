var URL = require("url");
var HTTP = require("q-io/http");

module.exports = proxyContainer;
function proxyContainer(request, host, route) {
    request.url = URL.resolve("http://" + host + "/" + route + "/", request.pathInfo.replace(/^\//, ""));
    return HTTP.request(request);
}
