var log = require("./common/logging").from(__filename);
var WebSocket = require("faye-websocket");

module.exports = ProxyWebsocket;
function ProxyWebsocket(containerManager, protocol) {
    return function (request, socket, body, projectInfo) {
        return containerManager.setup(projectInfo)
            .then(function (host) {
                // create server
                var wsServer = new WebSocket(request, socket, body);
                // create client
                log("create wsClient", "ws://" + host + request.url);
                var clientOptions = {
                    headers: request.headers
                };
                var wsClient = new WebSocket.Client("ws://" + host + request.url, [protocol], clientOptions);
                wsClient.on("close", function (event) {
                    wsServer.close(event.code, event.reason);
                });
                // pipe
                wsServer.pipe(wsClient).pipe(wsServer);
            }, function () {
                socket.write("HTTP/1.1 404 Not Found\r\n\r\n");
                socket.destroy();
            });
    };
}
