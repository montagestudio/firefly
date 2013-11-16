exports = module.exports = CheckSession;

function CheckSession(next) {
    return function(request, response) {
        var user = request.session.githubUser;

        if (user) {
            return next(request, response);
        } else {
            return {
                status: 403,
                headers: {
                    "content-type": "text/plain",
                },
                body: ["Not logged in"]
            };
        }
    };
}
