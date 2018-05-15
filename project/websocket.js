const log = require("logging").from(__filename);
const activity = require("./activity");

const Q = require("q");
const URL = require("url");
const uuid = require("uuid");
const FS = require("q-io/fs");
const WebSocket = require("faye-websocket");
const adaptWebsocket = require("./adapt-websocket");
const Connection = require("q-connection");
const Frontend = require("./frontend");

let websocketConnections = 0;

module.exports = websocket;
function websocket(config, workspacePath, services, request) {
    log("Websocket given services", Object.keys(services));

    return function (req, socket, body, wsQueue) {
        activity.increaseToolConnections();

        wsQueue = wsQueue || adaptWebsocket(new WebSocket(req, socket, body, ["firefly-app"]));

        const pathname = URL.parse(req.url).pathname;
        // used for logging
        const remoteAddress = socket.remoteAddress;
        let frontendId;
        let frontend;

        req.session = { username: config.username };
        log("websocket connection", remoteAddress, pathname, "open connections:", ++websocketConnections);

        frontendId = uuid.v4();

        log("Limiting", remoteAddress, pathname, "to", workspacePath);
        const connectionServices = FS.reroot(workspacePath)
        .then((fs) => makeServices(services, config, fs, pathname, workspacePath, request));

        // Throw errors if they happen in establishing services
        // This is not included in the chain of resolving connectionService
        // as we'd then be using done to set the connectionServices to undefined
        connectionServices.catch((error) => console.error(error));

        frontend = Connection(wsQueue, connectionServices, {
            capacity: 4096,
            onmessagelost(message) {
                log("*message to unknown promise*", message);
                console.error(new Error("message to unknown promise: " + JSON.stringify(message)), config.username);
            }
        });
        connectionServices.then(() => Frontend.addFrontend(frontendId, frontend)).done();

        wsQueue.closed.then(() => {
            log("disconnect websocket", config.username);
            connectionServices.then((services) => {
                return Q.allSettled(Object.keys(services).map((key) => services[key].invoke("close")));
            })
            .finally(() => {
                Frontend.deleteFrontend(frontendId).done();
                log("websocket connection closed", remoteAddress, pathname, "open connections:", --websocketConnections);
            })
            .finally(() => {
                activity.decreaseToolConnections();
            });
        });
    };
}

// export for testing
module.exports.makeServices = makeServices;
function makeServices(services, config, fs, env, pathname, fsPath, request) {
    const connectionServices = {};
    Object.keys(services).forEach((name) => {
        log("Creating", name);
        const service = services[name](config, fs, pathname, fsPath, request);
        connectionServices[name] = Q.master(service);
    });
    log("Finished creating services");
    return connectionServices;
}
