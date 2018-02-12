var Q = require("q");

module.exports = LogStackTraces;
function LogStackTraces(log) {
    return function logStackTraces(next) {
        return function (request, response) {
            return Q.when(next(request, response), null, function (error) {
                log("*" + error.stack + "*");
                throw error;
            });
        };
    };
}
