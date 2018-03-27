/* global XMLHttpRequest, localStorage */
var Promise = require("montage/core/promise").Promise;

/**
 * Makes an XHR requset
 * @param  {string|object} request A url, or request object
 * @param {string} request.url The URL to request.
 * @param {string} [request.method] The request method, such as "GET" or "POST"
 * @param {object} [request.headers] An object mapping from header name to value.
 * The value can be an array to set the same header multiple times.
 * @param {any} [request.body] The body of the request to send.
 * @param {string} [request.overrideMimeType] Override the return MIME-type of the request
 * @param {object} [request.options] An object of options to set on the XHR object, such as `responseType` or `withCredentials`
 * @return {Promise.<object>}         A promise for a response object
 * containing `status`, `headers`, `body` and `xhr` properties.
 */
exports.request = function (request) {
    request = normalizeRequest(request);
    var done = Promise.defer();

    var xhr = new XMLHttpRequest();
    xhr.open(request.method, request.url, true);

    xhr.onload = function() {
        done.resolve({
            status: xhr.status,
            headers: parseResponseHeaders(xhr.getAllResponseHeaders()),
            body: xhr.response,

            xhr: xhr
        });
    };
    xhr.onerror = function() {
        done.reject(new Error(""));
    };

    var headers = request.headers;
    xhr.setRequestHeader("x-access-token", localStorage.getItem("MontageStudioToken"));
    //jshint -W089
    for (var h in headers) {
        var value = headers[h];
        if (Array.isArray(value)) {
            for (var i = 0; i < value.length; i++) {
                xhr.setRequestHeader(h, value[i]);
            }
        } else {
            xhr.setRequestHeader(h, value);
        }
    }

    if (request.options) {
        var options = request.options;
        for (var o in options) {
            xhr[o] = options[o];
        }
    }
    //jshint +W089

    // Method can't be passed into options
    if (request.overrideMimeType) {
        xhr.overrideMimeType(request.overrideMimeType);
    }

    xhr.send(request.body);

    return done.promise;
};

/**
 * Makes an XHR request and only resolves the promise if the response status
 * is 200, otherwise it is rejected. The rejected Error object has a `response`
 * property containing the response.
 * @param  {string|object} request See documentation for `request`
 * @return {Promise.<object>}      See documentation for `request`
 */
exports.requestOk = function (request) {
    request = normalizeRequest(request);
    var url = request.url;

    return exports.request(request)
    .then(function (response) {
        if (response.status === 200) {
            return response;
        } else {
            var error = new Error("Could not load " + JSON.stringify(url) + ": " + response.status + " " + response.xhr.statusText);
            error.response = response;
            throw error;
        }
    });
};

function normalizeRequest(request) {
    if (typeof request === "string") {
        request = {
            url: request
        };
    }
    request.method = request.method || "GET";
    request.headers = request.headers || {};

    return request;
}

function parseResponseHeaders(headerString) {
    var headers = {};
    if (!headerString) {
        return headers;
    }

    headerString.replace(/^([^:]+):(.*)$/gm, function (_, header, value) {
        header = header.trim().toLowerCase();
        value = value.trim();

        if (header in headers) {
            // Put multiple headers of the same name into an array
            if (typeof headers[header] === "string") {
                headers[header] = [headers[header]];
            }
            headers[header].push(value);
        } else {
            headers[header] = value;
        }
    });

    return headers;
}
