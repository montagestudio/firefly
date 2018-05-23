const URL = require("url");
const HTTP = require("q-io/http");

module.exports = (request, host, route) => {
    request.url = URL.resolve("http://" + host + "/" + route + "/", request.pathInfo.replace(/^\//, ""));
    return HTTP.request(request);
}
