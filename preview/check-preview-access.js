var env = require("../environment");
var PreviewServer = require("./preview-server");
var preview = require("./../services/preview-service");
var frontend = require("../frontend");

exports = module.exports = CheckPreviewAccess;
exports.hasPreviewAccess = hasPreviewAccess;

function CheckPreviewAccess(next) {
    return function(request, response) {
        var host = request.headers.host;
        var hasAccess = hasPreviewAccess(host, request.session);

        if (hasAccess) {
            return next(request, response);
        } else {
            var accessCode = preview.getPreviewAccessCodeFromUrl(host);
            frontend.showNotification("Preview Code is: " + accessCode).done();
            return PreviewServer.servePreviewAccessForm(request);
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
        if (user && user.login === details.owner) {
            hasAccess = true;
        }
        // No reason to give a random user access to the preview if the owner
        // doesn't have it open in the tool.
        else if (preview.existsPreviewFromUrl(url)) {
            var previewAccess = session.previewAccess;
            if (previewAccess && previewAccess.indexOf(url) >= 0) {
                hasAccess = true;
            }
        }
    }

    return hasAccess;
}
