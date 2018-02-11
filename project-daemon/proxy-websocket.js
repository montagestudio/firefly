var log = require("../logging").from(__filename);
var WebSocket = require("faye-websocket");

module.exports = ProxyWebsocket;
function ProxyWebsocket(containerManager, sessions, protocol) {
    return function (request, socket, body, details) {
        return containerManager.setup(details)
        .then(function (projectWorkspaceUrl) {
            if (!projectWorkspaceUrl) {
                socket.write("HTTP/1.1 404 Not Found\r\n\r\n");
                socket.destroy();
                return;
            }
            // create server
            var wsServer = new WebSocket(request, socket, body);
            // create client
            log("create wsClient", "ws://" + projectWorkspaceUrl + request.url);
            var clientOptions = {
                headers: request.headers
            };
            var wsClient = new WebSocket.Client("ws://" + projectWorkspaceUrl + request.url, [protocol], clientOptions);
            wsClient.on("close", function (event) {
                wsServer.close(event.code, event.reason);
            });
            // pipe
            wsServer.pipe(wsClient).pipe(wsServer);
        });
    };
}
