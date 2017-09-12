var URL = require("url");
var Promise = require("bluebird");
var normalizeRequest = require("q-io/http").normalizeRequest;

module.exports = request;
function request(req) {
    req = normalizeRequest(req);

    // Do similar things to q-io/http ServerRequest
    var url = URL.parse(req.url);
    var defaults = {
        version: [1, 1],
        pathInfo: url.pathname,
        scriptName: "",
        scheme: "http",

        hostname: url.hostname,

        socket: null,
        remoteHost: "mock-request.example.com",
        remotePort: "0",

        body: [],

        node: null,
        nodeRequest: null,
        nodeConnection: null
    };

    //jshint -W089
    for (var p in defaults) {
        req[p] = req[p] || defaults[p];
    }

    if (Array.isArray(req.body)) {
        req.body.read = function () {
            return Promise.resolve(this.join(""));
        };
    }

    return req;
}

