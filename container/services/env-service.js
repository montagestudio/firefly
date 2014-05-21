module.exports = EnvService;
function EnvService(config, _, environment, pathname) {
    // Returned service
    var service = {};

    service.projectUrl = environment.getProjectUrl(config.subdomain);

    service.getEnv = function (key) {
        return environment[key];
    };

    return service;
}
