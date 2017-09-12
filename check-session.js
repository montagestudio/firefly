var env = require("./environment");
var log = require("./logging").from(__filename);
var Promise = require("bluebird");

exports = module.exports = CheckSession;

function CheckSession(ok, notOk) {
    notOk = notOk || redirect;
    return function (request) {
        if (request.session && request.session.githubUser) {
            return request.session.githubUser.then(function (user) {
                if (user) {
                    return ok(request);
                } else {
                    return notOk(request);
                }
            }, function (error) {
                log("*" + error.stack + "*");
                return notOk(request);
            });
        } else {
            return Promise.resolve(notOk(request));
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
