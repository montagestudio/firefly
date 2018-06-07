const FORBIDDEN_CHARS_RE = /[^0-9A-Za-z.\-_]/g;
const FORBIDDEN_CHARS_ALT = "-";
exports.sanitizeDirectoryName = (str) => str.replace(FORBIDDEN_CHARS_RE, FORBIDDEN_CHARS_ALT);
