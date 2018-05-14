// excludes "i", "l" and "o", so that they don't get confused with "1" or "0"
const accessCodeTable = "abcdefghjkmnpqrstuvwxyz".split("");

module.exports = (length = 8) => {
    // FIXME: This is easy to defeat.
    const code = [];
    for (let i = 0; i < length; i++) {
        const ix = Math.floor(Math.random() * accessCodeTable.length);
        code.push(accessCodeTable[ix]);
    }
    return code.join("");
}
