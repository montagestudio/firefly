var log = require("./logging").from(__filename);
var URL = require("url");

if (process.env.NODE_ENV === "test") {
    var path = require("path");
    require("dotenv").config({ path: path.join(__dirname, "..", "env", "development.env") });
}

function Env(options) {
    var env = options || { production: process.env.NODE_ENV === "production" };

    log("production", env.production);

    env.port = process.env.FIREFLY_PORT;

    log("port", env.port);

    env.app = URL.parse(process.env.FIREFLY_APP_URL);
    // Remove `host` so that `URL.format` uses `hostname` and `port` instead.
    // Remove `pathname` so that `URL.format` doesn't add "/" to the end,
    // messing up the CORS Accept-Origin header.
    delete env.app.host;
    delete env.app.pathname;

    log("app", JSON.stringify(env.app));

    env.project = URL.parse(process.env.FIREFLY_PROJECT_URL);
    delete env.project.host;
    delete env.project.pathname;

    log("project", JSON.stringify(env.project));

    env.getAppHost = function() {
        return getHost(this.app.hostname, this.app.port);
    };

    env.getAppUrl = function () {
        return URL.format(this.app);
    };

    env.getDetailsFromAppUrl = function (url) {
        var pathname = URL.parse(url).pathname;

        var match = pathname.match(/\/?([^\/]+)\/([^\/]+)/);
        if (!match) {
            throw new Error("Could not parse details from " + url);
        }
        var owner = match[1];
        var repo = match[2];

        return {
            owner: owner.toLowerCase(),
            repo: repo.toLowerCase()
        };
    };

    env.getProjectUrl = function (containerPath) {
        return URL.resolve(this.project.href, containerPath);
    };

    env.getProjectSubdomain = function (subdomain) {
        return URL.format(URL.parse(this.project.protocol + "//" + subdomain + "." + this.getProjectHost()));
    };

    env.getProjectHost = function() {
        return getHost(this.project.hostname, this.project.port);
    };

    return env;
}

function getHost(hostname, port) {
    return hostname + (port ? ":" + port : "");
}

module.exports = Env();
// for testing
module.exports.Env = Env;
module.exports.getHost = getHost;
