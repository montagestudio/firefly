var accessCodeTable = [];
//jshint -W004
for (var i = 0; i < 26; i++) {
    accessCodeTable.push(String.fromCharCode(97+i));
}
//jshint +W004

module.exports = generateAccessCode;
function generateAccessCode() {
    // FIXME: This is easy to defeat.
    var code = [];

    for (var i = 0; i < 8; i++) {
        var ix = Math.floor(Math.random() * accessCodeTable.length);
        code.push(accessCodeTable[ix]);
    }

    return code.join("");
}
