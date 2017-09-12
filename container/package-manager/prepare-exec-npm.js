var Promise = require("bluebird"),
    NPM = require("npm");

module.exports = function loadNPM (fsPath, request, execCommandCallBack) {
    return new Promise(function (resolve, reject) {
        NPM.load({
            // Commented out for the moment so that we can see what happens when
            // things go all wrong
            // "loglevel": "silent",
            "prefix": fsPath,
            "global": false
        }, function (error, result) {
            if (error) {
                reject(error);
            } else {
                resolve(result);
            }
        });
    })
    .then(function (loadedNPM) {

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
