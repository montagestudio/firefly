const log = require("logging").from(__filename);
const joey = require("joey");
const APPS = require("q-io/http-apps");
const URL = require("url");

const LogStackTraces = require("./log-stack-traces");
const ProjectInfo = require("./project-info");

const PreviewManager = require("./preview");

const proxyContainer = require("./proxy-container");
const ProxyWebsocket = require("./proxy-websocket");
const WebSocket = require("faye-websocket");

const requestHostStartsWith = (prefix) => (req) => req.headers.host.indexOf(prefix) === 0;

const getJwtProfile = async (request, authHeader) => {
    const options = {
        headers: {
            "Authentication": authHeader
        }
    };
    const { data } = await request.get("http://jwt/profile", options);
    return {
        profile: data.profile,
        token: data.token
    };
};

module.exports = (options = {}) => {
    const { containerManager, request } = options;
    //jshint -W116
    if (!containerManager) throw new TypeError("options.containerManager required");
    if (!request) throw new TypeError("options.request required");
    //jshint +W116

    const previewManager = new PreviewManager(containerManager);

    const chain = joey
    .error()
    .cors(process.env.FIREFLY_APP_URL, "*", "x-access-token")
    .headers({"Access-Control-Allow-Credentials": true})
    // Put here to avoid printing logs when HAProxy pings the server for
    // a health check
    .route(function () {
        this.OPTIONS("*").content("");
    })
    .use(LogStackTraces(log))
    .use((next) => async (req) => {
        try {
            const profile = await getJwtProfile(request, `Bearer ${req.headers["x-access-token"]}`);
            Object.assign(req, profile);
        } catch (e) {}
        return next(req);
    })
    // Public routes
    .route((any, GET, PUT, POST) => {
        POST("access", requestHostStartsWith("project"))
        .log(log, (message) => message)
        .app((req) => {
            const projectInfo = ProjectInfo.fromPath(req.pathname);
            return previewManager.processAccessRequest(req, projectInfo);
        });

        GET("...", requestHostStartsWith("project"))
        .log(log, (message) => message)
        .app((req) => previewManager.app(req));
    })
    .log(log, (message) => message)
    .use((next) => (req) => {
        if (!req.profile) {
            return APPS.responseForStatus(req, 401);
        } else {
            return next(req);
        }
    })
    // Private (authenticated) routes
    .route(function (any, GET) {
        GET("workspaces", requestHostStartsWith("api")).app(async (req) => {
            const containers = await containerManager.containersForUser(req.profile.username);
            return APPS.json(containers.map((container) => ({
                id: container.id
            })));
        });

        this.DELETE("workspaces", requestHostStartsWith("api")).app(async (req) => {
            log("delete stack", req.profile.username);
            await containerManager.deleteUserContainers(req.profile.username);
            return APPS.json({deleted: true});
        });

        any(":owner/:repo/...", requestHostStartsWith("api")).app(async (req) => {
            const projectInfo = new ProjectInfo(
                req.profile.username,
                req.params.owner,
                req.params.repo
            );
            const host = await containerManager.setup(projectInfo, req.token, req.profile);
            return proxyContainer(req, host, "api");
        });

        GET(":owner/:repo/...", requestHostStartsWith("build")).app(async (req) => {
            log("build");
            const projectInfo = new ProjectInfo(
                req.profile.username,
                req.params.owner,
                req.params.repo
            );
            const host = await containerManager.setup(projectInfo, req.token, req.profile);
            return proxyContainer(req, host, "build");
        });
    });

    const proxyAppWebsocket = ProxyWebsocket(containerManager, "firefly-app");
    chain.upgrade = async (req, socket, body) => {
        try {
            if (!WebSocket.isWebSocket(req)) {
                return;
            }
            if (requestHostStartsWith("project")(req)) {
                return previewManager.upgrade(req, socket, body);
            } else {
                log("filament websocket");
                const accessTokenMatch = /token=(.*?)(;|$)/.exec(req.headers.cookie);
                let profile;
                try {
                    profile = await getJwtProfile(request, `Bearer ${(accessTokenMatch && accessTokenMatch[1])}`);
                } catch (e) {
                    socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
                    socket.destroy();
                    return;
                }
                Object.assign(req, profile);
                const pathname = URL.parse(req.url).pathname;
                const match = pathname.match(/\/?([^/]+)\/([^/]+)/);
                if (!match) {
                    throw new Error("Could not parse details from " + req.url);
                }
                const owner = match[1];
                const repo = match[2];
                const details = new ProjectInfo(profile.profile.username, owner, repo);
                return proxyAppWebsocket(req, socket, body, details);
            }
        } catch (e) {
            log("*Error setting up websocket*", e.stack);
            socket.write("HTTP/1.1 500 Internal Server Error\r\n\r\n");
            socket.destroy();
            console.error(e, req);
        }
    };

    return chain;
}
