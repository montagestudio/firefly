var HttpApps = require("q-io/http-apps/fs");

// Need to do this because .file does not take an `fs` argument
module.exports = serveFile;
function serveFile(path, contentType, fs) {
    return function () {
        return function (request, response) {
            return HttpApps.file(request, path, contentType, fs);
        };
    };
}
