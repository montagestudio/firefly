var Q = require("q");
var Queue = require("q/queue");

module.exports = adaptWebsocket;
function adaptWebsocket(ws) {
    var queue = Queue();

    ws.on("message", function (event) {
        queue.put(event.data);
    });

    ws.on("close", function () {
        queue.close();
    });

    // So that we don't create a new promise for `ws` everytime `put` is called
    var promisedWs = Q(ws);
    return {
        "get": queue.get,
        "put": function(message) {
            return promisedWs.invoke("send", message);
        },
        "close": function () {
            ws.close();
            return queue.close();
        },
        "closed": queue.closed
    };
}
