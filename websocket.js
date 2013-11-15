var log = require("logging").from(__filename);
var parseCookies = require("./parse-cookies");
var ws = require("websocket.io");
var Connection = require("q-connection");

module.exports = websocket;
function websocket(session, services) {
    var socketServer = new ws.Server();
    socketServer.on("connection", function (connection) {
        // The request has the session cookies, but hasn't gone through
        // the joey chain, and so they haven't been parsed into .cookies
        // Do that manually here
        parseCookies(connection.req);

        // Use the above session id to get the session
        // TODO: unused at the moment, will be used to change where the
        // websocket looks for files etc.
        session.get(connection.req.cookies.session)
        .then(function (session) {
            log("websocket session:", session);
        })
        .done();

        Connection(connection, services);

        connection.on("close", function(conn) {
            log("websocket connection closed");
        });

        connection.on("error", function(err) {
            if (err.code !== 'ECONNRESET' && err.code !== 'EPIPE') {
                log("#connection error:", err);
            }
        });
    });

    return socketServer;
}
