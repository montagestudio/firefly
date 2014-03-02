// Don't track anything when running tests
if (typeof jasmine !== "undefined") {
    module.exports = {
        error: NOOP,
        message: NOOP,
        shutdown: NOOP
    };
    return;
}

var log = require("logging").from(__filename);
var Q = require("q");
var environment = require("./environment");
var rollbar = require("rollbar");

var config = {
    // The environment the code is running in.
    environment: environment.production ? "production" : "development",
    // The path to your code, (not including any trailing slash) which will be
    // used to link source files on Rollbar.
    root: __dirname,
    // The version or revision of your code.
    // This is set below depending on whether the GIT_HASH files exists
    // (production), or if we have to query git directly (development)
    // codeVersion
    // Custom addRequestData funciton for Joey
    addRequestData: addRequestData
};

setCodeVersion(config);
rollbar.init("afa2e8f334974bc58b0415fd06a02b40", config);
rollbar.handleUncaughtExceptions();

exports.error = function(error, request, data) {
    request.payloadData = data;
    rollbar.handleError(error, request, logErrorCallback);
};

exports.errorForUsername = function(error, username, data) {
    var request = {
        session: {username: username},
        payloadData: data
    };
    rollbar.handleError(error, request, logErrorCallback);
};

exports.message = function (message, request, data, level) {
    data = data || {};
    data.level = level || "info";
    rollbar.reportMessageWithPayloadData(message, data, request, logErrorCallback);
};

exports.messageForUsername = function (message, username, data, level) {
    var request = {session: {username: username}};
    exports.message(message, request, data, level);
};

exports.joeyErrors = function (next) {
    return function (request, response) {
        return Q.when(next(request, response), null, function (error) {
            exports.error(error, request);
            throw error;
        });
    };
};

exports.shutdown = function () {
    rollbar.shutdown();
};

function NOOP() {}
function logErrorCallback(e) {
    if (e) {
        log(e);
    }
}

// Adapted from the Rollbar library for Joey
function addRequestData(data, joeyRequest) {
    if (!joeyRequest) {
        return;
    }

    var scrubbedHeaders = scrubHeaders(joeyRequest.headers);

    //jshint -W106
    data.request = {
        method: joeyRequest.method,
        url: joeyRequest.url,
        headers: scrubbedHeaders,
        user_ip: scrubbedHeaders['x-forwarded-for'] || joeyRequest.remoteHost,
        GET: joeyRequest.query,
        // POST: use body if promise is resolved?
    };
    //jshint +W106

    if (joeyRequest.session) {
        data.person = {
            // id is needed for Rollbar to index the user
            id: joeyRequest.session.username,
            username: joeyRequest.session.username
        };
    }

    // This is a workaround for the Rollbar API not allowing payload data to
    // be added when reporting an error...
    //jshint -W089
    var payloadData = joeyRequest.payloadData;
    if (payloadData) {
        for (var p in payloadData) {
            data[p] = payloadData[p];
        }
    }
    //jshint +W089
}

function scrubHeaders(givenHeaders) {
    var headers = {};
    //jshint -W089
    for (var p in givenHeaders) {
        headers[p] = givenHeaders[p];
    }

    if (headers.cookie) {
        headers.cookie = headers.cookie.replace(/session=[^;]*/, "session=SCRUBBED");
    }
    //jshint +W089

    return headers;
}

function setCodeVersion(config) {
    var fs = require("fs");
    var Path = require("path");

    var GIT_HASH_PATH = Path.join(__dirname, "GIT_HASH");
    if (fs.existsSync(GIT_HASH_PATH)) {
        config.codeVersion = fs.readFileSync(GIT_HASH_PATH, "utf8").trim();
    } else {
        var exec = require("./container/exec");
        exec("git", ["rev-parse", "HEAD"], __dirname, true)
        .then(function (hash) {
            config.codeVersion = hash.trim();
            // We have to dive a bit deep into their API here, as we can't
            // call rollbar.init twice.
            rollbar.notifier.init(rollbar.api, config);
        });
    }
}
