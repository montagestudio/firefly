var log = require("logging").from(__filename);

var Q = require("q");
var URL = require("url");
var FS = require("q-io/fs");
var ws = require("websocket.io");
var Connection = require("q-connection");
var parseCookies = require("./parse-cookies");
var getProjectPath = require("./get-project-path");

module.exports = websocket;
function websocket(sessions, services) {
    log("Websocket given services", Object.keys(services));

    var socketServer = new ws.Server();
    socketServer.on("connection", function (connection) {
        var request = connection.req;
        var pathname = URL.parse(request.url).pathname;
        // used for logging
        var remoteAddress = connection.socket.remoteAddress;

        log("websocket connection", remoteAddress, pathname);

        var connectionServices = getSession(sessions, request)
        .then(function (session) {
            var path = getProjectPath(session, pathname);
            log("Limiting", remoteAddress, pathname, "to", path);
            return getFs(session, path);
        })
        .then(function (fs) {
            return makeServices(fs, services);
        });


        Connection(connection, connectionServices);

        connection.on("close", function(conn) {
            log("websocket connection closed", remoteAddress, pathname);
        });

        connection.on("error", function(err) {
            if (err.code !== 'ECONNRESET' && err.code !== 'EPIPE') {
                log("#connection error:", err);
            }
        });
    });

    return socketServer;
}

function getSession(sessions, request) {
    // The request has the session cookies, but hasn't gone through
    // the joey chain, and so they haven't been parsed into .cookies
    // Do that manually here
    parseCookies(request);

    // Use the above session id to get the session
    return sessions.get(request.cookies.session);
}

function getFs(session, path) {
    return FS.reroot(path);
}

function makeServices(fs, services) {
    var connectionServices = {};
    Object.keys(services).forEach(function (name) {
        log("Creating", name);
        var service = services[name](fs);
        connectionServices[name] = Q.master(service);
    });
    return connectionServices;
}
