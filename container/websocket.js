var Env = require("../environment");
var log = require("logging").from(__filename);

var Q = require("q");
var URL = require("url");
var uuid = require("uuid");
var FS = require("q-io/fs");
var WebSocket = require("faye-websocket");
var adaptWebsocket = require("./adapt-websocket");
var Connection = require("q-connection");
var Frontend = require("./frontend");

var websocketConnections = 0;

module.exports = websocket;
function websocket(config, services, clientPath) {
    log("Websocket given services", Object.keys(services));

    return function (request, socket, body) {
        var wsQueue = adaptWebsocket(new WebSocket(request, socket, body, ["firefly-app"]));

        var pathname = URL.parse(request.url).pathname;
        // used for logging
        var remoteAddress = socket.remoteAddress;
        var frontendId;
        var frontend;

        log("websocket connection", remoteAddress, pathname, "open connections:", ++websocketConnections);

        // FIXME docker use passed in config
        var path = "/workspace";

        frontendId = uuid.v4();

        log("Limiting", remoteAddress, pathname, "to", path);
        var connectionServices = FS.reroot(path)
        .then(function (fs) {
            return makeServices(services, config, fs, Env, pathname, path, clientPath);
        });

        // Throw errors if they happen in establishing services
        // This is not included in the chain of resolving connectionService
        // as we'd then be using done to set the connectionServices to undefined
        connectionServices.catch(function (error) {
            log("*" + error.stack + "*");
        });

        frontend = Connection(wsQueue, connectionServices);
        connectionServices.then(function() {
            return Frontend.addFrontend(frontendId, frontend);
        })
        .done();

        wsQueue.closed.then(function () {
            Object.keys(services).forEach(function (key) {
                if (typeof services[key].close === "function") {
                    services[key].close(request);
                }
            });
            Frontend.deleteFrontend(frontendId).done();
            log("websocket connection closed", remoteAddress, pathname, "open connections:", --websocketConnections);
        });
    };
}

// export for testing
module.exports.makeServices = makeServices;
function makeServices(services, config, fs, env, pathname, fsPath, clientPath) {
    var connectionServices = {};
    Object.keys(services).forEach(function (name) {
        log("Creating", name);
        var service = services[name](config, fs, env, pathname, fsPath, clientPath);
        connectionServices[name] = Q.master(service);
    });
    log("Finished creating services");
    return connectionServices;
}
