var Env = require("./environment");
var log = require("logging").from(__filename);

var Q = require("q");
var URL = require("url");
var FS = require("q-io/fs");
var ws = require("websocket.io");
var Connection = require("q-connection");

var websocketConnections = 0;

module.exports = websocket;
function websocket(sessions, services, clientPath) {
    log("Websocket given services", Object.keys(services));

    var socketServer = new ws.Server();
    socketServer.on("connection", function (connection) {
        var request = connection.req;
        var pathname = URL.parse(request.url).pathname;
        // used for logging
        var remoteAddress = connection.socket.remoteAddress;

        log("websocket connection", remoteAddress, pathname, "open connections:", ++websocketConnections);

        var connectionServices = sessions.getSession(request, function(session) {
            var path = Env.getProjectPathFromSessionAndAppUrl(session, pathname);
            log("Limiting", remoteAddress, pathname, "to", path);
            return getFs(session, path)
            .then(function (fs) {
                return makeServices(services, fs, Env, pathname, path, clientPath);
            });
        });

        // Throw errors if they happen in establishing services
        // This is not included in the chain of resolving connectionService
        // as we'd then be using done to set the connectionServices to undefined
        connectionServices.catch(function (error) {
            log("*" + error.stack + "*");
        });

        Connection(connection, connectionServices);

        connection.on("close", function(conn) {
            log("websocket connection closed", remoteAddress, pathname, "open connections:", --websocketConnections);
        });

        connection.on("error", function(err) {
            if (err.code !== 'ECONNRESET' && err.code !== 'EPIPE') {
                log("#connection error:", err, "open connections:", --websocketConnections);
            }
        });
    });

    return socketServer;
}

function getFs(session, path) {
    return FS.reroot(path);
}

// export for testing
module.exports.makeServices = makeServices;
function makeServices(services, fs, env, pathname, fsPath, clientPath) {
    var connectionServices = {};
    Object.keys(services).forEach(function (name) {
        log("Creating", name);
        var service = services[name](fs, env, pathname, fsPath, clientPath);
        connectionServices[name] = Q.master(service);
    });
    return connectionServices;
}
