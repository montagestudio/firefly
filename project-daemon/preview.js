const log = require("logging").from(__filename);

const FS = require("q-io/fs");
const HTTP = require("q-io/http");
const HttpApps = require("q-io/http-apps/fs");
const querystring = require("querystring");
const generateAccessCode = require("./generate-access-code");
const ProjectInfo = require("./project-info");
const proxyContainer = require("./proxy-container");
const ProxyWebsocket = require("./proxy-websocket");
const Set = require("collections/set");
const Map = require("collections/map");

const CLIENT_ROOT = FS.join(__dirname, "preview");
const clientFs = FS.reroot(CLIENT_ROOT);

const HOST_ACCESS_CODE_MAP = new Map();

exports = module.exports = class PreviewManager {
    constructor(containerManager) {
        this.containerManager = containerManager;
        this.proxyWebsocket = ProxyWebsocket(containerManager, "firefly-preview");
    }

    async app(request) {
        const projectInfo = ProjectInfo.fromPath(request.pathInfo);
        const hasAccess = this.hasAccess(request, projectInfo);
        if (hasAccess) {
            // Remove the /user/owner/repo/ part of the URL, project services don't see this
            request.pathInfo = request.pathInfo.replace(projectInfo.toPath(), "/");
            try {
                return await proxyContainer(request, this.containerManager.hostForProjectInfo(projectInfo), "static");
            } catch (error) {
                // If there's an error making the request then serve
                // the no preview page. The container has probably
                // been shut down due to inactivity
                return this.serveNoPreviewPage(request);
            }
        } else {
            const projectWorkspaceUrl = await this.containerManager.setup(projectInfo, request.token, request.profile)
            if (projectWorkspaceUrl) {
                let code = this.getAccessCode(projectInfo);
                // Chunk into groups of 4 by adding a space after
                // every 4th character except if it's at the end of
                // the string
                code = code.replace(/(....)(?!$)/g, "$1 ");
                try {
                    await HTTP.request({
                        method: "POST",
                        url: "http://" + projectWorkspaceUrl + "/notice",
                        headers: {"content-type": "application/json; charset=utf8"},
                        body: [JSON.stringify("Preview access code: " + code)]
                    });
                } catch (error) {
                    log("*Error with preview access code*", error.stack);
                }
            }

            // Serve the access form regardless, so that people
            // can't work out if a project exists or not.
            return this.serveAccessForm(request);
        }
    }

    async upgrade(request, socket, body) {
        const projectInfo = ProjectInfo.fromPath(request.url);
        if (projectInfo) {
            const hasAccess = this.hasAccess(request, projectInfo);
            if (hasAccess) {
                log("preview websocket", request.headers.host);
                return this.proxyWebsocket(request, socket, body, projectInfo);
            } else {
                socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
                socket.destroy();
            }
        } else { 
            socket.write("HTTP/1.1 404 Not Found\r\n\r\n");
            socket.destroy();
        }
    }

    /**
     * The owner always has access to its own projects.
     * All other users will only have access if they have been authenticated to see
     * this preview and the owner has it open in the tool.
     */
    hasAccess(request, projectInfo) {
        // TODO: 3rd party access is not implemented
        if (projectInfo.private) {
            const isUserOwner = request.githubUser && request.githubUser.login.toLowerCase() === projectInfo.username;
            if (isUserOwner) {
                return true;
            } else {
                return request.previewAccess && request.previewAccess.has(projectInfo);
            }
        } else {
            return true;
        }
    }

    async serveAccessForm(request) {
        const fs = await clientFs;
        return HttpApps.file(request, "access.html", null, fs);
    }

    async serveNoPreviewPage(request) {
        const fs = await clientFs;
        const response = await HttpApps.file(request, "no-preview.html", null, fs);
        response.status = 404;
        return response;
    }

    async processAccessRequest(request, projectInfo) {
        // Get code from the body data
        const body = await request.body.read();
        if (body.length > 0) {
            const query = querystring.parse(body.toString());
            let { code } = query;
            if (code) {
                // strip whitespace and make lowercase
                code = code.replace(/\s/g, "").toLowerCase();
                const accessCode = this.getAccessCode(projectInfo);

                if (code === accessCode) {
                    if (request.previewAccess) {
                        request.previewAccess.add(projectInfo);
                    } else {
                        request.previewAccess = Set([projectInfo]);
                    }
                    log("access granted ", projectInfo);
                }
            }
            log("access denied");
        }
        // 302 - Temporary redirect using GET
        return {
            status: 302,
            headers: {
                Location: "/index.html"
            }
        };
    }

    getAccessCode(projectInfo) {
        let code = HOST_ACCESS_CODE_MAP.get(projectInfo);
        if (!code) {
            code = generateAccessCode();
            HOST_ACCESS_CODE_MAP.set(projectInfo, code);
        }
        return code;
    }
}
