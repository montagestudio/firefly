var log = require("logging").from(__filename);
var environment = require("../environment");
var APPS = require("q-io/http-apps");

var _previews = {"/": {name:"/", path:"/", default:"index.html"}};
var registerDeferredRequestTimer;
var DEFERRED_REQUEST_TIMEOUT = 10000;

exports._previews = _previews;

exports.unregisterAllConnections = function() {
    Object.keys(_previews).forEach(function(previewId) {
        if (previewId !== "/") {
            delete _previews[previewId];
        }
    });
};

exports.registerConnection = function(connection) {
    var previewId = exports.getPreviewIdFromUrl(connection.req.headers.host),
        preview = _previews[previewId];

    if (preview) {
        if (!preview.connections) {
            preview.connections = [connection];
        } else {
            preview.connections.push(connection);
        }
    }
};

exports.unregisterConnection = function(connection) {
    var previewId = exports.getPreviewIdFromUrl(connection.req.headers.host),
        preview = _previews[previewId];

    if (preview) {
        var connections = preview.connections;
        for (var i in connections) {
            if (connections[i] === connection) {
                connections.splice(i, 1);
            }
        }
    }
};

exports.registerDeferredResponse = function(url, responseDeferred) {
    var previewId = exports.getPreviewIdFromUrl(url),
        preview = _previews[previewId];

    if (preview) {
        var info = {
            response: responseDeferred,
            date: Math.round(new Date().getTime() / 1000)
        };

        if (!preview.requests) {
            preview.requests = [info];
        } else {
            preview.requests.push(info);
        }

        log("new deferred response stored");

        if (!registerDeferredRequestTimer) {
            // Setup a time to reject old requests
            registerDeferredRequestTimer = setInterval(function() {
                var currentTime = Math.round(new Date().getTime() / 1000);

                Object.keys(_previews).forEach(function(previewId) {
                    var preview = _previews[previewId],
                        cutIndex;

                    if (preview.requests) {
                        for (var j = 0, info; (info = preview.requests[j]); j++) {
                            if (Math.abs(currentTime - info.date) > 30) {
                                info.response.reject();
                                cutIndex = j;
                            }
                        }

                        if (typeof cutIndex !== "undefined") {
                            // Trim the array of all expired requests
                            preview.requests.splice(0, j + 1);
                            if (preview.requests.length === 0) {
                                delete preview.requests;
                            }
                        }
                    }
                });
            }, DEFERRED_REQUEST_TIMEOUT);
        }
    } else {
        log("registerDeferredRequest: invalid previewID", previewId);
        responseDeferred.reject(new Error("Invalid previewID: " + previewId));
    }
};

exports.existsPreviewFromUrl = function(url) {
    var previewId = exports.getPreviewIdFromUrl(url);
    return previewId in _previews;
};

exports.getPreviewAccessCodeFromUrl = function(url) {
    var previewId = exports.getPreviewIdFromUrl(url),
        preview = _previews[previewId];

    if (preview) {
        return preview.accessCode;
    }
};

exports.getPreviewIdFromUrl = function(url) {
    var details = environment.getDetailsfromProjectUrl(url);

    return details.owner + "-" + details.repo;
};

/**
 * The actual service for the tool. We don't put the previous functions exposed
 * in the service because they're not meant to be available to anyone there.
 * There is the possibility that someone could just craft the right connection
 * object and unregister any preview connection, even if it's not theirs.
 */
exports.service = PreviewService;

function PreviewService() {
    var service = {};

    service.register = function(parameters) {
        var name = parameters.name,
            url = parameters.url,
            previewId = exports.getPreviewIdFromUrl(url);

        log("register new preview", previewId);
        _previews[previewId] = {
            name: name,
            url: url,
            accessCode: generateAccessCode()
        };
        log("access code: ", _previews[previewId].accessCode);
        //saveMap();
    };

    service.unregister = function(url) {
        var previewId = exports.getPreviewIdFromUrl(url);
        var preview = _previews[previewId];

        if (preview) {
            log("unregister preview", previewId);
            // Websocket connections
            if (preview.connections) {
                for (var i = 0, ii = preview.connections.length; i < ii; i++) {
                    preview.connections[i].close();
                }
            }
            // HTTP requests
            if (preview.requests) {
                //jshint -W004
                for (var i = 0, ii = preview.requests.length; i < ii; i++) {
                    preview.requests[i].response.fail();
                }
                //jshint +W004
            }
            delete _previews[previewId];
        }

        //saveMap();
    };

    service.refresh = function(url) {
        sendToPreviewClients(url, "refresh:");
    };

    function sendToPreviewClients(url, content) {
        var previewId = exports.getPreviewIdFromUrl(url);
        var preview = _previews[previewId];

        if (preview) {
            // Websocket connections
            if (preview.connections) {
                for (var i = 0, ii = preview.connections.length; i < ii; i++) {
                    preview.connections[i].send(content);
                }
            }
            // HTTP requests
            if (preview.requests) {
                //jshint -W004
                for (var i = 0, ii = preview.requests.length; i < ii; i++) {
                    preview.requests[i].response.resolve(APPS.ok(content));
                }
                //jshint +W004
            }
        }
    }

    var accessCodeTable = [];
    //jshint -W004
    for (var i = 0; i < 26; i++) {
        accessCodeTable.push(String.fromCharCode(65+i), String.fromCharCode(97+i));
    }
    for (var i = 0; i < 10; i++) {
        accessCodeTable.push(""+i);
    }
    //jshint +W004

    function generateAccessCode() {
        // FIXME: This is easy to defeat.
        var code = [];

        for (var i = 0; i < 5; i++) {
            var ix = Math.floor(Math.random() * accessCodeTable.length);
            code.push(accessCodeTable[ix]);
        }

        return code.join("");
    }

    return service;
}