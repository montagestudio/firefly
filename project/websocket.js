var log = require("logging").from(__filename);
var activity = require("./activity");

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
function websocket(config, workspacePath, services, request) {
    log("Websocket given services", Object.keys(services));

    return function (req, socket, body, wsQueue) {
        activity.increaseToolConnections();

        wsQueue = wsQueue || adaptWebsocket(new WebSocket(req, socket, body, ["firefly-app"]));

        var pathname = URL.parse(req.url).pathname;
        // used for logging
        var remoteAddress = socket.remoteAddress;
        var frontendId;
        var frontend;

        req.session = { username: config.username };
        log("websocket connection", remoteAddress, pathname, "open connections:", ++websocketConnections);

        frontendId = uuid.v4();

        log("Limiting", remoteAddress, pathname, "to", workspacePath);
        var connectionServices = FS.reroot(workspacePath)
        .then(function (fs) {
            return makeServices(services, config, fs, pathname, workspacePath, request);
        });

        // Throw errors if they happen in establishing services
        // This is not included in the chain of resolving connectionService
        // as we'd then be using done to set the connectionServices to undefined
        connectionServices.catch(function (error) {
            console.error(error);
        });

        frontend = Connection(wsQueue, connectionServices, {
            capacity: 4096,
            onmessagelost: function (message) {
                log("*message to unknown promise*", message);
                console.error(new Error("message to unknown promise: " + JSON.stringify(message)), config.username);
            }
        });
        connectionServices.then(function() {
            return Frontend.addFrontend(frontendId, frontend);
        })
        .done();

        wsQueue.closed.then(function () {
            log("disconnect websocket", config.username);
            connectionServices.then(function(services) {
                return Q.allSettled(Object.keys(services).map(function (key) {
                    return services[key].invoke("close");
                }));
            })
            .finally(function() {
                Frontend.deleteFrontend(frontendId).done();
                log("websocket connection closed", remoteAddress, pathname, "open connections:", --websocketConnections);
            })
            .finally(function () {
                activity.decreaseToolConnections();
            });
        });
    };
}

// export for testing
module.exports.makeServices = makeServices;
function makeServices(services, config, fs, pathname, fsPath, request) {
    var connectionServices = {};
    Object.keys(services).forEach(function (name) {
        log("Creating", name);
        var service = services[name](config, fs, pathname, fsPath, request);
        connectionServices[name] = Q.master(service);
    });
    log("Finished creating services");
    return connectionServices;
}
