var URL = require("url");

var production = process.env.NODE_ENV === "production";

var env = {
    production: !!production
};
module.exports = env;

if(production) {
    env.app = {
        hostname: process.env.FIREFLY_APP_HOST || "localhost",
        port: process.env.FIREFLY_APP_PORT || 2440,
        protocol: process.env.FIREFLY_APP_PROTOCOL || "http"
    };
    env.project = {
        hostname: process.env.FIREFLY_PROJECT_HOST || "127.0.0.1",
        port: process.env.FIREFLY_PROJECT_PORT || 2440,
        protocol: process.env.FIREFLY_PROJECT_PROTOCOL || "http"
    };
    env.getProjectUrl = function (pathname) {
        throw new Error("TODO");
    };
} else {
    env.app = {
        hostname: "app.127.0.0.1.xip.io",
        port: 2440,
        protocol: "http"
    };
    env.project = {
        hostname: "project.127.0.0.1.xip.io",
        port: 2441,
        protocol: "http"
    };
    env.getDetailsFromAppUrl = function (url) {
        var pathname = URL.parse(url).pathname;

        var match = pathname.match(/\/?([^\/]+)\/([^\/]+)/);
        var owner = match[1];
        var repo = match[2];

        return {
            owner: owner,
            repo: repo
        };
    };
    env.getDetailsfromProjectUrl = function (url) {
        // Needed because node's URL.parse interprets
        // a.b.c.com:1234
        // as
        // protocol: "a.b.c.d.com"
        // hostname: "2440"
        if (!/^https?:\/\//.test(url)) {
            url = "http://" + url;
        }
        var hostname = URL.parse(url).hostname;

        var match = hostname.match(/([a-z]+)-([a-z]+)\./i);
        var owner = match[1];
        var repo = match[2];

        return {
            owner: owner,
            repo: repo
        };
    };
    env.getProjectUrlFromAppUrl = function (url) {
        var details = this.getDetailsFromAppUrl(url);
        var urlObj = Object.create(this.project);
        urlObj.hostname = details.owner + "-" + details.repo + "." + urlObj.hostname;
        return URL.format(urlObj);
    };
    env.getProjectPathFromSessionAndAppUrl = function (session, url) {
        var details = this.getDetailsFromAppUrl(url);

        // FIXME not to use FS
        var FS = require("q-io/fs");
        return FS.join(process.cwd(), "..", "clone", session.username, details.owner, details.repo);
    };
    env.getProjectPathFromSessionAndProjectUrl = function (session, url) {
        var details = this.getDetailsfromProjectUrl(url);

        // FIXME not to use FS
        var FS = require("q-io/fs");
        return FS.join(process.cwd(), "..", "clone", session.username, details.owner, details.repo);
    };
}

env.getAppUrl = function () {
    return URL.format(this.app);
};
