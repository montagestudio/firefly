var env = require("./environment");

exports = module.exports = CheckSession;

function CheckSession(ok, notOk) {
    notOk = notOk || redirect;
    return function (request) {
        if (request.session.githubUser) {
            return request.session.githubUser.then(function (user) {
                if (user) {
                    return ok(request);
                } else {
                    return notOk(request);
                }
            });
        } else {
            return notOk(request);
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
