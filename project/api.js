const log = require("logging").from(__filename);
const joey = require("joey");
const JsonApps = require("q-io/http-apps/json");

const sanitize = require("./sanitize");

// TODO version API by reading header Accept: application/vnd.firefly.v2+json
module.exports = (config) => joey.route(function (route, GET, PUT, POST) {
    let initializingPromise;

    POST("init")
    .app((request) => handleEndpoint(config, request,
        () => {
            log("init handleEndpoint");
            if (!initializingPromise || initializingPromise.isRejected()) {
                initializingPromise = request.projectWorkspace.initializeWorkspace();
                initializingPromise.catch((error) => {
                    console.error("Error initializing", error, error.stack);
                });
            }
        },
        () => ({ message: "initializing"})
    ));

    POST("init_popcorn")
    .app((request) => handleEndpoint(config, request,
        () => {
            log("init_popcorn handleEndpoint");
            if (!initializingPromise) {
                initializingPromise = request.projectWorkspace.initializeWithTemplate("/root/popcorn");
                initializingPromise.catch((error) => {
                    console.error("Error initializing popcorn", error, error.stack);
                });
            }
        },
        () => ({ message: "initializing"})
    ));

    GET("init/progress")
    .app((request) => handleEndpoint(config, request,
        () => initializingPromise && initializingPromise.inspect().state,
        (state) => ({state: state})
    ));

    POST("components")
    .app((request) => handleEndpoint(config, request,
        (data) => request.projectWorkspace.createComponent(data.name, data.destination),
        (result) => {
            if (result.success === true) {
                result.message = "created";
            }
            return result;
        }
    ));

    POST("modules")
    .app((request) => handleEndpoint(config, request,
        (data) => request.projectWorkspace.createModule(
            data.name, data.extendsModuleId, data.extendsName, data.destination),
        (result) => {
            if (result.success === true) {
                result.message = "created";
            }
            return result;
        }
    ));

    POST("flush")
    .app((request) => handleEndpoint(config, request,
        (data) => request.projectWorkspace.flushWorkspace(data.message),
        (result) => {
            if (result.success === true) {
                result.message = "flushed";
            }
            return result;
        }
    ));

    GET("workspace")
    .app((request) => handleEndpoint(config, request,
        () => initializingPromise && !initializingPromise.isFulfilled() ?
            "initializing" : request.projectWorkspace.existsWorkspace(),
        (status) => ({created: status})
    ));

    POST("save")
    .app((request) => handleEndpoint(config, request,
        (data) => request.projectWorkspace.saveFile(data.filename, data.contents),
        () => ({message: "saved"})
    ));
});

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
async function handleEndpoint(config, request, endpointCallback, successCallback) {
    const owner = sanitize.sanitizeDirectoryName(config.owner),
        repo = sanitize.sanitizeDirectoryName(config.repo);

    const createMessage = (message) => {
        message.owner = owner;
        message.repo = repo;
        return message;
    };

    try {
        const body = await request.body.read();
        let data;

        if (body.length > 0) {
            try {
                data = JSON.parse(body.toString());
            } catch(ex) {
                throw new Error("Malformed JSON message received.");
            }
        } else {
            data = {};
        }

        await endpointCallback(data);
        let successMessage;

        if (successCallback) {
            successMessage = successCallback(arguments[0]);
        } else {
            successMessage = {};
        }

        return JsonApps.json(createMessage(successMessage));
    } catch (error) {
        console.error("handleEndpoint fail", error.stack);
        return JsonApps.json(createMessage({
            error: error.message
        }));
    }
}
