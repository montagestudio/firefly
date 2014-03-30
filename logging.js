var logging = require("logging");

var SCRUB = [
    {match: /[a-f0-9]+:x-oauth-basic/ig, replace: "SCRUBBED:x-oauth-basic"}
];
var SCRUB_LENGTH = SCRUB.length;

var OPTIONS = {
    filter: function (message) {
        if (typeof message === "string") {
            for (var i = 0; i < SCRUB_LENGTH; i++) {
                message = message.replace(SCRUB[i].match, SCRUB[i].replace);
            }
        }
        return message;
    }
};

// Mainly here for testability, but used to create exports.from as well
exports.makeFrom = function (givenOptions) {
    var options = OPTIONS;

    //jshint -W089
    if (givenOptions) {
        options = Object.create(OPTIONS);
        for (var p in givenOptions) {
            options[p] = givenOptions[p];
        }
    }
    //jshint +W089

    return function from(path) {
        return logging.from(path, options);
    };
};

exports.from = exports.makeFrom();
