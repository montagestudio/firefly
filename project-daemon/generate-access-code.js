// excludes "i", "l" and "o", so that they don't get confused with "1" or "0"
var accessCodeTable = "abcdefghjkmnpqrstuvwxyz".split("");

module.exports = generateAccessCode;
function generateAccessCode(length) {
    length = length || 8;
    // FIXME: This is easy to defeat.
    var code = [];

    for (var i = 0; i < length; i++) {
        var ix = Math.floor(Math.random() * accessCodeTable.length);
        code.push(accessCodeTable[ix]);
    }

    return code.join("");
}
