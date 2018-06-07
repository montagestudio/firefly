const Q = require('q'),
    NPM = require('npm');

module.exports = async function loadNPM (fsPath, request, execCommandCallBack) {
    const loadedNPM = await Q.ninvoke(NPM, "load", {
        // Commented out for the moment so that we can see what happens when
        // things go all wrong
        // "loglevel": "silent",
        "prefix": fsPath,
        "global": false
    });
    try {
        const response = await execCommandCallBack(loadedNPM, request);
        process.send({
            response: response
        });
    } catch (error) {
        process.send({
            error: error
        });
    }
};
