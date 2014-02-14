module.exports = EnvService;
function EnvService(_, __, environment, pathname) {
    // Returned service
    var service = {};

    service.projectUrl = environment.getProjectUrlFromAppUrl(pathname);

    service.getEnv = function (key) {
        return environment[key];
    };

    return service;
}
