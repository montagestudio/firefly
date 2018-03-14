var FORBIDDEN_CHARS_RE = /[^0-9A-Za-z\.\-_]/g;
var FORBIDDEN_CHARS_ALT = "-";

exports.sanitizeDirectoryName = sanitizeDirectoryName;

function sanitizeDirectoryName(str) {
    return str.replace(FORBIDDEN_CHARS_RE, FORBIDDEN_CHARS_ALT);
}