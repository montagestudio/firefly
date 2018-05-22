var URL = require("url");

module.exports = EnvService;
function EnvService(config, _, pathname) {
    // Returned service
    var service = {};

    service.projectUrl = URL.resolve(process.env.FIREFLY_PROJECT_URL || "https://project.local.montage.studio:2440", config.subdomain);

    return service;
}
