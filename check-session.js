var env = require("./environment");
var packedSession = require("./packed-session");

exports = module.exports = CheckSession;

function CheckSession(key) {
    return function(next) {
        return function(request, response) {
            var user = request.session.githubUser;

            if (user) {
                return next(request, response);
            } else {
                // Restore the session if the session id is a valid github token
                var sessionID = request.cookies[key];
                return packedSession.unpack(sessionID, request.session).then(function(userValid) {
                    if (userValid) {
                        return next(request, response);
                    } else {
                        return {
                            status: 302,
                            headers: {
                                "Location": env.getAppUrl()
                            }
                        };
                    }
                });
            }
        };
    };
}
