var Promise = require("bluebird");

exports = module.exports = Session;
function Session(sessions) {
    var result = function (app) {
        return function (request, response) {
            // self-awareness
            if (request.session) {
                return app(request, response);
            }
            request.session = sessions[request.cookies.session] || {};
            return app(request, response);
        };
    };

    result.get = function (id) {
        return Promise.resolve(sessions[id]);
    };

    result.getKey = function() {
        return "session";
    };

    return result;
}
