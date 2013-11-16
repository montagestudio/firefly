var FS = require("q-io/fs");

module.exports = getProjectPath;
function getProjectPath(session, pathname) {
    return FS.join(process.cwd(), "..", "clone");
}
