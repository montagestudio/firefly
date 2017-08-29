var log = require("../logging").from(__filename);
var environment = require("../environment");

var FS = require("q-io/fs");
var Q = require("q");
var HttpApps = require("q-io/http-apps/fs");
var querystring = require("querystring");
var generateAccessCode = require("./generate-access-code");
var Set = require("collections/set");
var Map = require("collections/map");

var CLIENT_ROOT = FS.join(__dirname, "preview");
var clientFs = FS.reroot(CLIENT_ROOT);

var HOST_ACCESS_CODE_MAP = new Map();

function endsWith(str, suffix) {
    return str.indexOf(suffix, str.length - suffix.length) !== -1;
}

exports.isPreview = function (request) {
    return endsWith(request.headers.host, environment.getProjectHost());
};

/**
 * The owner always has access to its own projects.
 * All other users will only have access if they have been authenticated to see
 * this preview and the owner has it open in the tool.
 */
exports.hasAccess = function (previewDetails, session) {
    return Q.try(function () {
        if (session && session.githubUser) {
            return session.githubUser.then(function (githubUser) {
                // The user doesn't need to have explicit access to its own previews.
                var access = githubUser && githubUser.login.toLowerCase() === previewDetails.username;

                return access || has3rdPartyAccess(previewDetails, session);
            });
        } else if (previewDetails.private) {
            return has3rdPartyAccess(previewDetails, session);
        } else {
            return true;
        }
    });
};

function has3rdPartyAccess(previewDetails, session) {
    if (session && session.previewAccess) {
        return session.previewAccess.has(previewDetails);
    } else {
        return false;
    }
}

exports.serveAccessForm = function (request) {
    return clientFs.then(function(fs) {
        return HttpApps.file(request, "access.html", null, fs);
    });
};

exports.serveNoPreviewPage = function (request) {
    return clientFs.then(function(fs) {
        return HttpApps.file(request, "no-preview.html", null, fs)
        .then(function (response) {
            response.status = 404;
            return response;
        });
    });
};

exports.processAccessRequest = function (request, previewDetails) {
    // Get code from the body data
    return request.body.read()
    .then(function(body) {
        if (body.length > 0) {
            var query = querystring.parse(body.toString());

            maybeGrantAccessToPreview(query.code, previewDetails, request.session);
        }

        // 302 - Temporary redirect using GET
        return {
            status: 302,
            headers: {
                Location: "/index.html"
            }
        };
    });
};

exports.getAccessCode = function (previewDetails) {
    var code = HOST_ACCESS_CODE_MAP.get(previewDetails);
    if (!code) {
        code = generateAccessCode();
        HOST_ACCESS_CODE_MAP.set(previewDetails, code);
    }
    return code;
};

function maybeGrantAccessToPreview(code, previewDetails, session) {
    if (code) {
        // strip whitespace and make lowercase
        code = code.replace(/\s/g, "").toLowerCase();
        var accessCode = exports.getAccessCode(previewDetails);

        if (code === accessCode) {
            if (session.previewAccess) {
                session.previewAccess.add(previewDetails);
            } else {
                session.previewAccess = Set([previewDetails]);
            }
            log("access granted ", previewDetails);
            return true;
        }
    }

    log("access denied");
    return false;
}
