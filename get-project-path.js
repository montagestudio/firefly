var FS = require("q-io/fs");

module.exports = getProjectPath;
function getProjectPath(session, pathname) {
    // FIXME, use same logic from environment.getProjectUrl
    var match = pathname.match(/\/?([^\/]+)\/([^\/]+)/);
    return FS.join(process.cwd(), "..", "clone", session.username, match[1], match[2]);
}
