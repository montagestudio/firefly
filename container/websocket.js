var Env = require("../environment");
var log = require("../logging").from(__filename);
var track = require("../track");

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
function websocket(config, workspacePath, services, clientPath) {
    log("Websocket given services", Object.keys(services));

    return function (request, socket, body, wsQueue) {
        wsQueue = wsQueue || adaptWebsocket(new WebSocket(request, socket, body, ["firefly-app"]));

        var pathname = URL.parse(request.url).pathname;
        // used for logging
        var remoteAddress = socket.remoteAddress;
        var frontendId;
        var frontend;

        request.session = { username: config.username };
        track.message("connect websocket", request);
        log("websocket connection", remoteAddress, pathname, "open connections:", ++websocketConnections);

        frontendId = uuid.v4();

        log("Limiting", remoteAddress, pathname, "to", workspacePath);
        var connectionServices = FS.reroot(workspacePath)
        .then(function (fs) {
            return makeServices(services, config, fs, Env, pathname, workspacePath, clientPath);
        });

        // Throw errors if they happen in establishing services
        // This is not included in the chain of resolving connectionService
        // as we'd then be using done to set the connectionServices to undefined
        connectionServices.catch(function (error) {
            log("*" + error.stack + "*");
            track.errorForUsername(error, config.username);
        });

        frontend = Connection(wsQueue, connectionServices, {max: 50});
        connectionServices.then(function() {
            return Frontend.addFrontend(frontendId, frontend);
        })
        .done();

        wsQueue.closed.then(function () {
            track.messageForUsername("disconnect websocket", config.username);
            connectionServices.then(function(services) {
                return Q.allSettled(Object.keys(services).map(function (key) {
                    return services[key].invoke("close");
                }));
            })
            .finally(function() {
                Frontend.deleteFrontend(frontendId).done();
                log("websocket connection closed", remoteAddress, pathname, "open connections:", --websocketConnections);
            });
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
