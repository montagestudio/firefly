var Promise = require("bluebird");

module.exports = LogStackTraces;
function LogStackTraces(log) {
    return function logStackTraces(next) {
        return function (request, response) {
            return Promise.resolve(next(request, response))
            .catch(function (error) {
                log("*" + error.stack + "*");
                throw error;
            });
        };
    };
}
