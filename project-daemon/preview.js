var log = require("./common/logging").from(__filename);
var track = require("./common/track");
var environment = require("./common/environment");

var FS = require("q-io/fs");
var Q = require("q");
var HTTP = require("q-io/http");
var HttpApps = require("q-io/http-apps/fs");
var querystring = require("querystring");
var generateAccessCode = require("./generate-access-code");
var PreviewDetails = require("./preview-details");
var proxyContainer = require("./proxy-container");
var ProxyWebsocket = require("./proxy-websocket");
var Set = require("collections/set");
var Map = require("collections/map");

var CLIENT_ROOT = FS.join(__dirname, "preview");
var clientFs = FS.reroot(CLIENT_ROOT);

var HOST_ACCESS_CODE_MAP = new Map();

function PreviewManager(containerManager, sessions) {
    this.containerManager = containerManager;
    this.sessions = sessions;
    this.proxyWebsocket = ProxyWebsocket(containerManager, sessions, "firefly-preview");
    this.route = this.route.bind(this);
}
exports = module.exports = PreviewManager;

PreviewManager.prototype.isPreview = function (request) {
    return request.headers.host === environment.getProjectHost();
};

PreviewManager.prototype.route = function (next) {
    var self = this;
    return function (request, response) {
        // requests on the project domain are preview requests, everything else is handled elsewhere
        if (!self.isPreview(request)) {
            return next(request, response);
        }

        var previewDetails = PreviewDetails.fromPath(request.pathInfo);
        return self.hasAccess(previewDetails, request.session).then(function (hasAccess) {
            if (hasAccess) {
                var projectWorkspaceUrl = self.containerManager.getUrl(previewDetails);
                if (!projectWorkspaceUrl) {
                    return self.serveNoPreviewPage(request);
                }
                // Remove the /user/owner/repo/ part of the URL, project services don't see this
                request.pathInfo = request.pathInfo.replace(previewDetails.toPath(), "/");
                return proxyContainer(request, projectWorkspaceUrl, "static")
                .catch(function (error) {
                    // If there's an error making the request then serve
                    // the no preview page. The container has probably
                    // been shut down due to inactivity
                    return self.serveNoPreviewPage(request);
                });
            } else {
                self.containerManager.setup(previewDetails)
                .then(function (projectWorkspaceUrl) {
                    if (!projectWorkspaceUrl) {
                        return;
                    }
                    var code = self.getAccessCode(previewDetails);
                    // Chunk into groups of 4 by adding a space after
                    // every 4th character except if it's at the end of
                    // the string
                    code = code.replace(/(....)(?!$)/g, "$1 ");
                    return HTTP.request({
                        method: "POST",
                        url: "http://" + projectWorkspaceUrl + "/notice",
                        headers: {"content-type": "application/json; charset=utf8"},
                        body: [JSON.stringify("Preview access code: " + code)]
                    });
                })
                .catch(function (error) {
                    log("*Error with preview access code*", error.stack);
                    track.error(error, request);
                });

                // Serve the access form regardless, so that people
                // can't work out if a project exists or not.
                return self.serveAccessForm(request);
            }
        });
    };
};

PreviewManager.prototype.upgrade = function (request, socket, body) {
    var self = this,
        previewDetails = PreviewDetails.fromPath(request.url);
    return this.sessions.getSession(request, function (session) {
        if (previewDetails) {
            return self.hasAccess(previewDetails, session);
        } else {
            return false;
        }
    }).then(function (hasAccess) {
        if (hasAccess) {
            log("preview websocket", request.headers.host);
            return self.proxyWebsocket(request, socket, body, previewDetails);
        } else {
            socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
            socket.destroy();
        }
    });
};

/**
 * The owner always has access to its own projects.
 * All other users will only have access if they have been authenticated to see
 * this preview and the owner has it open in the tool.
 */
PreviewManager.prototype.hasAccess = function (previewDetails, session) {
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

PreviewManager.prototype.serveAccessForm = function (request) {
    return clientFs.then(function(fs) {
        return HttpApps.file(request, "access.html", null, fs);
    });
};

PreviewManager.prototype.serveNoPreviewPage = function (request) {
    return clientFs.then(function(fs) {
        return HttpApps.file(request, "no-preview.html", null, fs)
        .then(function (response) {
            response.status = 404;
            return response;
        });
    });
};

PreviewManager.prototype.processAccessRequest = function (request, previewDetails) {
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

PreviewManager.prototype.getAccessCode = function (previewDetails) {
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
        var accessCode = PreviewManager.prototype.getAccessCode(previewDetails);

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
