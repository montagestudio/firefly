exports = module.exports = Session;
function Session(object) {
    var result = function (app) {
        return function (request, response) {
            // self-awareness
            if (request.session) {
                return app(request, response);
            }
            request.session = object;
            return app(request, response);
        };
    };

    result.get = function (id) {
        return object;
    };

    return result;
}
