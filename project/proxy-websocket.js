var log = require("logging").from(__filename);
var environment = require("../environment");
var WebSocket = require("faye-websocket");

module.exports = ProxyWebsocket;
function ProxyWebsocket(setupProjectContainer, sessions) {
    return function (request, socket, body) {
        return sessions.getSession(request, function (session) {
            request.session = session;

            var details = environment.getDetailsFromAppUrl(request.url);
            request.params = request.params || {};
            request.params.owner = details.owner;
            request.params.repo = details.repo;

            return setupProjectContainer(function (request) {
                // create server
                var wsServer = new WebSocket(request, socket, body);
                // create client
                log("create wsClient", "ws://127.0.0.1:" + request.projectWorkspacePort + request.url);
                var wsClient = new WebSocket.Client("ws://127.0.0.1:" + request.projectWorkspacePort + request.url);
                wsClient.on("close", function (event) {
                    wsServer.close(event.code, event.reason);
                });
                wsServer.on("close", function (event) {
                    wsClient.close(event.code, event.reason);
                });
                // pipe
                wsServer.pipe(wsClient).pipe(wsServer);
            })(request);
        });
    };
}
