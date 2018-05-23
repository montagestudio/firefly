const log = require("logging").from(__filename);
const WebSocket = require("faye-websocket");

module.exports = (containerManager, protocol) => async (request, socket, body, projectInfo) => {
    try {
        const host = await containerManager.setup(projectInfo, request.token, request.profile)
        // create server
        const wsServer = new WebSocket(request, socket, body);
        // create client
        log("create wsClient", "ws://" + host + request.url);
        const clientOptions = {
            headers: request.headers
        };
        const wsClient = new WebSocket.Client("ws://" + host + request.url, [protocol], clientOptions);
        wsClient.on("close", (event) => {
            wsServer.close(event.code, event.reason);
        });
        // pipe
        wsServer.pipe(wsClient).pipe(wsServer);
    } catch (err) {
        socket.write("HTTP/1.1 404 Not Found\r\n\r\n");
        socket.destroy();
    }
}
