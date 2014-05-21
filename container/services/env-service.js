module.exports = EnvService;
function EnvService(session, _, environment, pathname) {
    // Returned service
    var service = {};

    service.projectUrl = environment.getProjectUrl(session.subdomain);

    service.getEnv = function (key) {
        return environment[key];
    };

    return service;
}
