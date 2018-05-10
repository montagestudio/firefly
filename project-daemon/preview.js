var log = require("./common/logging").from(__filename);
var track = require("./common/track");

var FS = require("q-io/fs");
var Q = require("q");
var HTTP = require("q-io/http");
var HttpApps = require("q-io/http-apps/fs");
var querystring = require("querystring");
var generateAccessCode = require("./generate-access-code");
var ProjectInfo = require("./project-info");
var proxyContainer = require("./proxy-container");
var ProxyWebsocket = require("./proxy-websocket");
var Set = require("collections/set");
var Map = require("collections/map");

var CLIENT_ROOT = FS.join(__dirname, "preview");
var clientFs = FS.reroot(CLIENT_ROOT);

var HOST_ACCESS_CODE_MAP = new Map();

function PreviewManager(containerManager) {
    this.containerManager = containerManager;
    this.proxyWebsocket = ProxyWebsocket(containerManager, "firefly-preview");
}
exports = module.exports = PreviewManager;

PreviewManager.prototype.app = function (request) {
    var self = this;
    var projectInfo = ProjectInfo.fromPath(request.pathInfo);
    return self.hasAccess(request, projectInfo).then(function (hasAccess) {
        if (hasAccess) {
            // Remove the /user/owner/repo/ part of the URL, project services don't see this
            request.pathInfo = request.pathInfo.replace(projectInfo.toPath(), "/");
            return proxyContainer(request, self.containerManager.hostForProjectInfo(projectInfo), "static")
            .catch(function (error) {
                // If there's an error making the request then serve
                // the no preview page. The container has probably
                // been shut down due to inactivity
                return self.serveNoPreviewPage(request);
            });
        } else {
            self.containerManager.setup(projectInfo, request.token, request.profile)
            .then(function (projectWorkspaceUrl) {
                if (!projectWorkspaceUrl) {
                    return;
                }
                var code = self.getAccessCode(projectInfo);
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

PreviewManager.prototype.upgrade = function (request, socket, body) {
    var self = this,
        projectInfo = ProjectInfo.fromPath(request.url);
    log("PreviewManager.upgrade", request.githubUser);
    if (!projectInfo) {
        socket.write("HTTP/1.1 404 Not Found\r\n\r\n");
        socket.destroy();
        return Promise.resolve();
    } else {
        return self.hasAccess(request, projectInfo)
            .then(function (hasAccess) {
                if (hasAccess) {
                    log("preview websocket", request.headers.host);
                    return self.proxyWebsocket(request, socket, body, projectInfo);
                } else {
                    socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
                    socket.destroy();
                }
            });
    }
};

/**
 * The owner always has access to its own projects.
 * All other users will only have access if they have been authenticated to see
 * this preview and the owner has it open in the tool.
 */
PreviewManager.prototype.hasAccess = function (request, projectInfo) {
    return Q.try(function () {
        if (request.githubUser) {
            // The user doesn't need to have explicit access to its own previews.
            var access = request.githubUser && request.githubUser.login.toLowerCase() === projectInfo.username;

            return access || has3rdPartyAccess(request, projectInfo);
        } else if (projectInfo.private) {
            return has3rdPartyAccess(request, projectInfo);
        } else {
            return true;
        }
    });
};

function has3rdPartyAccess(request, projectInfo) {
    // TOOD: Implement
    if (request.previewAccess) {
        return request.previewAccess.has(projectInfo);
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

PreviewManager.prototype.processAccessRequest = function (request, projectInfo) {
    // Get code from the body data
    return request.body.read()
    .then(function(body) {
        if (body.length > 0) {
            var query = querystring.parse(body.toString());

            maybeGrantAccessToPreview(request, query.code, projectInfo);
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

PreviewManager.prototype.getAccessCode = function (projectInfo) {
    var code = HOST_ACCESS_CODE_MAP.get(projectInfo);
    if (!code) {
        code = generateAccessCode();
        HOST_ACCESS_CODE_MAP.set(projectInfo, code);
    }
    return code;
};

function maybeGrantAccessToPreview(request, code, projectInfo) {
    if (code) {
        // strip whitespace and make lowercase
        code = code.replace(/\s/g, "").toLowerCase();
        var accessCode = PreviewManager.prototype.getAccessCode(projectInfo);

        if (code === accessCode) {
            if (request.previewAccess) {
                request.previewAccess.add(projectInfo);
            } else {
                request.previewAccess = Set([projectInfo]);
            }
            log("access granted ", projectInfo);
            return true;
        }
    }

    log("access denied");
    return false;
}
