var WebSocket = require('faye-websocket'),
    FS        = require("q-io/fs");
var log = require("../logging").from(__filename);

module.exports = function(root) {
    return FS.reroot(root).then(function(fs) {
        log("Rerooting to " + root);
        return new MrWebsocket(fs);
    });
};

function MrWebsocket(fs) {
    this._fs = fs;
    this.onUpgrade = this.onUpgrade.bind(this);
}

MrWebsocket.prototype.onUpgrade = function(request, socket, body) {
    if (WebSocket.isWebSocket(request)) {
        var self = this;
        var ws = new WebSocket(request, socket, body, ["mr"]);

        log("mr-websocket connection");
        ws.on('message', function(event) {
            self.serveRequest(event.data).then(function(response) {
                ws.send(response);
            });
        });

        ws.on('close', function(event) {
            log('close', event.code, event.reason);
            ws = null;
        });
    }
};

MrWebsocket.prototype.parseRequest = function(data) {
    var requestLines = data.split("\n");
    var method = requestLines.shift();
    var request = {};
    var headers = {};

    var methodMatch = /GET\s+(.*)$/.exec(method);

    if (methodMatch) {
        request.method = "GET";
        request.path = methodMatch[1];
    }

    requestLines.forEach(function(line) {
        var headMatch = /^(\S*)\s*:\s*(.*)$/.exec(line);
        if (headMatch) {
            headers[headMatch[1].toLowerCase()] = headMatch[2];
        }
    });
    request.headers = headers;

    return request;
};

MrWebsocket.prototype.serveRequest = function(data) {
    var request = this.parseRequest(data);
    var headers = request.headers;
    var path = request.path;

    return this._fs.read(path)
    .then(function(content) {
        return "200 OK\n" +
            "Request-Id: " + headers['request-id'] + "\n\n" +
            content.toString();
    }, function(reason) {
        log(reason);
        return "500 Internal Server Error\n" +
            "Request-Id: " + headers['request-id'] + "\n\n" +
            "Error reading file " + path;
    });
};