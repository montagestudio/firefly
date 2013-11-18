var log = require("logging").from(__filename);

var spawn = require("child_process").spawn;
var Q = require("q");

/**
 * Wrap executing a command in a promise
 * @param  {string} command command to execute
 * @param  {Array<string>} args    Arguments to the command.
 * @param  {string} cwd     The working directory to run the command in.
 * @return {Promise}        A promise for the completion of the command.
 */
module.exports = function exec(command, args, cwd) {
    var deferred = Q.defer();


    var proc = spawn(command, args, { cwd: cwd });
    log("["+proc.pid+"]", "(" + command + " '" + args.join("' '") + "')", "# in", cwd);

    var stderr = "";
    proc.stderr.on("data", function (chunk) {
        stderr += chunk.toString("utf8");
    });

    proc.on("error", function (error) {
        deferred.reject(error);
    });

    proc.on("exit", function (code) {
        if (stderr) {
            log("["+proc.pid+"]", "stderr", "*" + stderr + "*");
        }
        if (code !== 0) {
            deferred.reject(new Error("'" + command + " " + args.join(" ") + "' in " + cwd + " exited with code " + code));
        } else {
            deferred.resolve();
        }
    });

    return deferred.promise;
};
