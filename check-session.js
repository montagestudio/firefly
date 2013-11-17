var env = require("./environment");

exports = module.exports = CheckSession;

function CheckSession(next) {
    return function(request, response) {
        var user = request.session.githubUser;

        if (user) {
            return next(request, response);
        } else {
            return {
                status: 301,
                headers: {
                    "Location": env.app.protocol + "://" + env.app.hostname + ":" + env.app.port
                }
            };
        }
    };
}
