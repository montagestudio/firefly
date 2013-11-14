var parseCookies = require("./parse-cookies");
var ws = require("websocket.io");
var Connection = require("q-connection");

module.exports = websocket;
function websocket(server, session, services) {
    var socketServer = ws.attach(server.node);
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
            console.log("websocket session:", session);
        })
        .done();

        Connection(connection, services);

        connection.on("close", function(conn) {
            console.warn("websocket connection closed");
        });

        connection.on("error", function(err) {
            if (err.code !== 'ECONNRESET' && err.code !== 'EPIPE') {
                console.log("#connection error:", err);
            }
        });
    });
}
