var env = require("./environment");

exports = module.exports = CheckSession;

function CheckSession(key) {
    return function(next) {
        return function(request, response) {
            var user = request.session.githubUser;

            if (user) {
                return next(request, response);
            } else {
                return {
                    status: 302,
                    headers: {
                        "Location": env.getAppUrl()
                    }
                };
            }
        };
    };
}
