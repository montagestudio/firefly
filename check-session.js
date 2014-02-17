var env = require("./environment");

exports = module.exports = CheckSession;

function CheckSession(next) {
    return function (request, response) {
        if (request.session.githubUser) {
            return request.session.githubUser.then(function (user) {
                if (user) {
                    return next(request, response);
                } else {
                    return redirect();
                }
            });
        } else {
            return redirect();
        }
    };
}

function redirect() {
    return {
        status: 302,
        headers: {
            "Location": env.getAppUrl()
        }
    };
}
