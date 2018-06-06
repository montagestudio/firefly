var log = require("logging").from(__filename);
var joey = require("joey");
var JsonApps = require("q-io/http-apps/json");

var sanitize = require("./sanitize");

module.exports = function (config) {
    // TODO version API by reading header Accept: application/vnd.firefly.v2+json
    return joey.route(function (route, GET, PUT, POST) {
        var initializingPromise;

        POST("init_empty")
        .app(function (request) {
            return handleEndpoint(config, request, function() {
                log("init handleEndpoint");
                if (!initializingPromise || initializingPromise.isRejected()) {
                    initializingPromise = request.projectWorkspace.initializeWithEmptyProject();
                    initializingPromise.catch(function (error) {
                        console.error("Error initializing", error, error.stack);
                    });
                }
            }, function() {
                return {message: "initializing"};
            });
        });

        POST("init_repository")
        .app(function (request) {
            return handleEndpoint(config, request, function() {
                log("init handleEndpoint");
                if (!initializingPromise || initializingPromise.isRejected()) {
                    initializingPromise = request.projectWorkspace.initializeWithRepository();
                    initializingPromise.catch(function (error) {
                        console.error("Error initializing", error, error.stack);
                    });
                }
            }, function() {
                return {message: "initializing"};
            });
        });

        POST("init_popcorn")
        .app(function (request) {
            return handleEndpoint(config, request, function() {
                log("init_popcorn handleEndpoint");
                if (!initializingPromise) {
                    initializingPromise = request.projectWorkspace.initializeWithTemplate("/root/popcorn");
                    initializingPromise.catch(function (error) {
                        console.error("Error initializing popcorn", error, error.stack);
                    });
                }
            }, function() {
                return {message: "initializing"};
            });
        });

        POST("components")
        .app(function (request) {
            return handleEndpoint(config, request, function(data) {
                return request.projectWorkspace.createComponent(
                    data.name, data.destination);
            }, function(result) {
                if (result.success === true) {
                    result.message = "created";
                }
                return result;
            });
        });

        POST("modules")
        .app(function (request) {
            return handleEndpoint(config, request, function(data) {
                return request.projectWorkspace.createModule(
                    data.name, data.extendsModuleId,
                    data.extendsName, data.destination);
            }, function(result) {
                if (result.success === true) {
                    result.message = "created";
                }
                return result;
            });
        });

        POST("flush")
        .app(function (request) {
            return handleEndpoint(config, request, function(data) {
                return request.projectWorkspace.flushWorkspace(
                    data.message);
            }, function(result) {
                if (result.success === true) {
                    result.message = "flushed";
                }
                return result;
            });
        });

        GET("workspace")
        .app(function (request) {
            return handleEndpoint(config, request, function() {
                return initializingPromise && !initializingPromise.isFulfilled() ?
                    "initializing" : request.projectWorkspace.existsWorkspace();
            }, function(status) {
                return {created: status};
            });
        });

        POST("save")
        .app(function (request) {
            return handleEndpoint(config, request, function(data) {
                return request.projectWorkspace.saveFile(
                    data.filename, data.contents);
            }, function() {
                return {message: "saved"};
            });
        });

    });
};

/**
 * Endpoints (to be moved to another file in the future)
 */

/**
 * Executes an operation and depending on the result creates a success or error
 * message to send back to the browser.
 * The message is in the shape: {"owner": ..., "repo": ...}
 *
 * @param {function} endpointCallback The function that performs the operation
 *        of the endpoint, returns a promise to the completion of the operation.
 *        The function receives the owner and the repo as arguments.
 *        If the operation succeeds then {@link successCallback} is called with
 *        the resolved value. If the operation fails then an error message is
 *        returned.
 * @param {function} successCallback The function that receives the value of
 *        that the operation resolved it and is expected to return the message
 *        that will be turned into a response back to the browser.
 */
function handleEndpoint(config, request, endpointCallback, successCallback) {
    var owner = sanitize.sanitizeDirectoryName(config.owner),
        repo = sanitize.sanitizeDirectoryName(config.repo);

    var createMessage = function(message) {
        message.owner = owner;
        message.repo = repo;
        return message;
    };

    return request.body.read()
    .then(function(body) {
        var data;

        if (body.length > 0) {
            try {
                data = JSON.parse(body.toString());
            } catch(ex) {
                throw new Error("Malformed JSON message received.");
            }
        } else {
            data = {};
        }

        return endpointCallback(data);
    })
    .then(function() {
        var successMessage;

        if (successCallback) {
            successMessage = successCallback(arguments[0]);
        } else {
            successMessage = {};
        }

        return JsonApps.json(createMessage(successMessage));
    })
    .fail(function(error) {
        console.error("handleEndpoint fail", error.stack);
        return JsonApps.json(createMessage({
            error: error.message
        }));
    });
}
