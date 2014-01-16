var log = require("logging").from(__filename);
var env = require("../../environment");
var PreviewServer = require("./preview-server");
var PreviewService = require("../services/preview-service");
var Frontend = require("../frontend");

exports = module.exports = CheckPreviewAccess;
exports.hasPreviewAccess = hasPreviewAccess;

function CheckPreviewAccess(next) {
    return function(request, response) {
        var host = request.headers.host;
        var hasAccess = hasPreviewAccess(host, request.session);

        if (hasAccess) {
            return next(request, response);
        } else {
            var accessCode = PreviewService.getPreviewAccessCodeFromUrl(host);
            var details = env.getDetailsfromProjectUrl(host);
            var frontendId = details.owner + "/" + details.owner + "/" + details.repo;

            return Frontend.getFrontend(frontendId)
            .then(function(frontend) {
                if (frontend) {
                    frontend.showNotification("Preview Code is: " + accessCode).done();
                } else {
                    log("Frontend service is not available.");
                }
                return PreviewServer.servePreviewAccessForm(request);
            });
        }
    };
}

/**
 * The owner always has access to its own projects.
 * All other users will only have access if they have been authenticated to see
 * this preview and the owner has it open in the tool.
 */
function hasPreviewAccess(url, session) {
    var hasAccess = false;

    if (session) {
        var user = session.githubUser;
        var details = env.getDetailsfromProjectUrl(url);
        // The user doesn't need to have explicit access to its own previews.
        if (user && user.login.toLowerCase() === details.owner) {
            hasAccess = true;
        } else if (PreviewService.existsPreviewFromUrl(url)) {
            // No reason to give a random user access to the preview if the owner
            // doesn't have it open in the tool.
            var previewAccess = session.previewAccess;
            if (previewAccess && previewAccess.indexOf(url) >= 0) {
                hasAccess = true;
            }
        }
    }

    return hasAccess;
}
