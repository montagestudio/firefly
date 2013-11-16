module.exports = EnvService;
function EnvService(_, environment, pathname) {
    // Returned service
    var service = {};

    service.projectUrl = environment.getProjectUrl(pathname);

    service.getEnv = function (key) {
        return environment[key];
    };

    return service;
}
