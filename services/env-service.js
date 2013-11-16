var Env = require("../environment");


module.exports = EnvService;
function EnvService() {
    // Returned service
    var service = {};

    service.getEnv = function (key) {
        return Env[key];
    };

    return service;
}
