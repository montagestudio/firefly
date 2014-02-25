var log = require("logging").from(__filename);
var environment = require("../environment");

var FS = require("q-io/fs");
var Q = require("q");
var HttpApps = require("q-io/http-apps/fs");
var querystring = require("querystring");

var CLIENT_ROOT = FS.join(__dirname, "preview");
var clientFs = FS.reroot(CLIENT_ROOT);

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
exports.hasAccess = function (url, session) {
    return Q.try(function () {
        if (session && session.githubUser) {
            return session.githubUser.then(function (githubUser) {
                var details = environment.getDetailsfromProjectUrl(url);
                // The user doesn't need to have explicit access to its own previews.
                return githubUser && githubUser.login.toLowerCase() === details.owner;
            });
        } else {
            // No reason to give a random user access to the preview if the owner
            // doesn't have it open in the tool.
            var previewAccess = session.previewAccess;
            return previewAccess && previewAccess.indexOf(url) >= 0;
        }

        return false;
    });
};

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

exports.processAccessRequest = function (request) {
    // Get code from the body data
    return request.body.read()
    .then(function(body) {
        if (body.length > 0) {
            var query = querystring.parse(body.toString());

            maybeGrantAccessToPreview(
                query.code, request.headers.host, request.session);
        }

        // 302 - Temporary redirect using GET
        return {
            status: 302,
            headers: {
                Location: "/index.html"
            }
        };
    });
}

function maybeGrantAccessToPreview(code, previewHost, session) {
    // var accessCode = preview.getPreviewAccessCode(previewHost);

    // if (code && accessCode && code === accessCode) {
    if (code === "XXX") {
        if (session.previewAccess) {
            if (session.previewAccess.indexOf(previewHost) === -1) {
                session.previewAccess.push(previewHost);
            }
        } else {
            session.previewAccess = [previewHost];
        }
        log("access granted ", previewHost);
        return true;
    } else {
        log("access denied");
        return false;
    }
}
