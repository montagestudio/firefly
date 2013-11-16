var production = process.env.NODE_ENV;

var env = {
    production: !!production
};
module.exports = env;

if(production) {
    env.app = {
        host: process.env.FIREFLY_APP_HOST || "localhost",
        port: process.env.FIREFLY_APP_PORT || 2440,
        protocol: process.env.FIREFLY_APP_PROTOCOL || "http"
    };
    env.project = {
        host: process.env.FIREFLY_PROJECT_HOST || "127.0.0.1",
        port: process.env.FIREFLY_PROJECT_PORT || 2440,
        protocol: process.env.FIREFLY_PROJECT_PROTOCOL || "http"
    };
} else {
    env.app = {
        host: "localhost",
        port: 2440,
        protocol: "http"
    };
    env.project = {
        host: "localhost",
        port: 2441,
        protocol: "http"
    };
}

Object.defineProperty(env, "appUrl", {
    get: function () {
        return this.app.protocol + "://" + this.app.host + ":" + this.app.port;
    }
});
Object.defineProperty(env, "projectUrl", {
    get: function () {
        return this.project.protocol + "://" + this.project.host + ":" + this.project.port;
    }
});


