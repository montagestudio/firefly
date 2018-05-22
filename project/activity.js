var log = require("logging").from(__filename);

var NO_CONNECTIONS_TIMEOUT = 5 * 60 * 1000; // 5 minutes
var shutdownTimeout;
var toolConnections = 0;
var previewConnections = 0;

function checkConnections() {
    var totalConnections = toolConnections + previewConnections;
    if (totalConnections === 0) {
        shutdownTimeout = setTimeout(shutdown, NO_CONNECTIONS_TIMEOUT);
    } else {
        clearTimeout(shutdownTimeout);
    }
}

function shutdown() {
    // What about pending git operations?
    // FIXME, WE'LL DO IT LIVE
    log("shut down due inactvity for " + NO_CONNECTIONS_TIMEOUT + " ms");
    process.exit(0);
}

exports.increaseToolConnections = function () {
    toolConnections++;
    checkConnections();
};

exports.decreaseToolConnections = function () {
    toolConnections--;
    checkConnections();
};

exports.increasePreviewConnections = function () {
    previewConnections++;
    checkConnections();
};

exports.decreasePreviewConnections = function () {
    previewConnections--;
    checkConnections();
};

// Run checkConnections here so that if the user never connects to the
// container, it will shutdown
checkConnections();
