var ContentApps = require("q-io/http-apps/content");

exports = module.exports = CheckSession;

function CheckSession(next) {
    return function(request, response) {
        var user = request.session.githubUser;

        if (user) {
            return next(request, response);
        } else {
            return ContentApps.content("Not logged in!");
        }
    };
}