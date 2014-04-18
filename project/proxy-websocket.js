var log = require("../logging").from(__filename);
var WebSocket = require("faye-websocket");

module.exports = ProxyWebsocket;
function ProxyWebsocket(setupProjectContainer, sessions, protocol) {
    return function (request, socket, body, details) {
        return setupProjectContainer(
            details.username,
            details.owner,
            details.repo
        )
        .then(function (projectWorkspacePort) {
            if (!projectWorkspacePort) {
                socket.write("HTTP/1.1 404 Not Found\r\n\r\n");
                socket.destroy();
                return;
            }
            // create server
            var wsServer = new WebSocket(request, socket, body);
            // create client
            log("create wsClient", "ws://127.0.0.1:" + projectWorkspacePort + request.url);
            var clientOptions = {
                headers: request.headers
            };
            var wsClient = new WebSocket.Client("ws://127.0.0.1:" + projectWorkspacePort + request.url, [protocol], clientOptions);
            wsClient.on("close", function (event) {
                wsServer.close(event.code, event.reason);
            });
            wsServer.on("close", function (event) {
                wsClient.close(event.code, event.reason);
            });
            // pipe
            wsServer.pipe(wsClient).pipe(wsServer);
        });
    };
}
