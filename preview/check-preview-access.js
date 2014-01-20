var env = require("../environment");
var PreviewServer = require("./preview-server");
var preview = require("./../services/preview-service");
var frontend = require("../frontend");

exports = module.exports = CheckPreviewAccess;

function CheckPreviewAccess(next) {
    return function(request, response) {
        var user = request.session.githubUser;
        var host = request.headers.host;
        var details = env.getDetailsfromProjectUrl(host);
        var hasAccess = false;

        // The user doesn't need to have explicit access to its own previews.
        if (user && user.login === details.owner) {
            hasAccess = true;
        } else {
            var previewAccess = request.session.previewAccess;
            if (previewAccess && previewAccess.indexOf(host) >= 0) {
                hasAccess = true;
            }
        }

        if (hasAccess) {
            return next(request, response);
        } else {
            var accessCode = preview.getPreviewAccessCodeFromUrl(host);
            frontend.showNotification("Preview Code is: " + accessCode).done();
            return PreviewServer.servePreviewAccessForm(request);
        }
    };
}
