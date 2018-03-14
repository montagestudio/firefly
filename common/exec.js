var log = require("./logging").from(__filename);

var spawn = require("child_process").spawn;
var Q = require("q");

/**
 * Wrap executing a command in a promise
 * @param  {string} command command to execute
 * @param  {Array<string>} args    Arguments to the command.
 * @param  {string} cwd     The working directory to run the command in.
 * @param  {bool} shouldReturnOutput     set to true if stdout should be returned.
 * @return {Promise}        A promise for the completion of the command.
 */
module.exports = function exec(command, args, cwd, shouldReturnOutput) {
    var deferred = Q.defer();
    var stdout;

    var proc = spawn(command, args, {
        cwd: cwd,
        stdio: ['ignore', (shouldReturnOutput === true ? 'pipe' : 'ignore'), 'pipe']
    });
    log("["+proc.pid+"]", "(" + command + " '" + args.join("' '") + "')", "# in", cwd);

    if (shouldReturnOutput) {
        stdout = "";
        proc.stdout.on('data', function (chunk) {
            stdout += chunk.toString("utf8");
        });
    }

    var stderr = "";
    proc.stderr.on("data", function (chunk) {
        stderr += chunk.toString("utf8");
    });

    proc.on("error", function (error) {
        deferred.reject(error);
    });

    proc.on("close", function (code) {
        if (code !== 0) {
            deferred.reject(new Error("'" + command + " " + args.join(" ") + "' in " + cwd + " exited with code " + code));
            if (stderr) {
                log("["+proc.pid+"]", "stderr", "*" + stderr.trim() + "*");
            }
        } else {
            if (shouldReturnOutput) {
                return deferred.resolve(stdout);
            } else {
                return deferred.resolve();
            }
        }
    });

    return deferred.promise;
};
