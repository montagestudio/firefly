var Q = require('q'),
    NPM = require('npm');

module.exports = function loadNPM (fsPath, request, execCommandCallBack) {
    return Q.ninvoke(NPM, "load", {
        // Commented out for the moment so that we can see what happens when
        // things go all wrong
        // "loglevel": "silent",
        "prefix": fsPath,
        "global": false
    }).then(function (loadedNPM) {

        return execCommandCallBack(loadedNPM, request).then(function (response) {

            process.send({
                response: response
            });

        }, function (error) {

            process.send({
                error: error
            });

        });
    });
};
