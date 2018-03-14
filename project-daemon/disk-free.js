var exec = require("./common/exec");

var PERCENT_RE = /([0-9]+)%/;

module.exports = function df() {
    return exec("df", [], "/", true)
    .then(function (output) {
        var lines = output.split("\n");

        // First line is the column headers, second line is "/"
        var root = lines[1];
        var match = PERCENT_RE.exec(root);

        if (match && match[1]) {
            return parseInt(match[1], 10);
        } else {
            throw new Error("Could not get percent disk free of /");
        }
    });
};
