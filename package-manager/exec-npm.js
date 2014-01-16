/*global __dirname */

var fork = require('child_process').fork,
    Q = require("q"),

    COMMANDS = {
        VIEW: 'view',
        INSTALL: 'install',
        OUTDATED: 'outdated'
    };

/**
 * Wrap executing the npm command in a promise.
 * @param {string} command - The npm command to execute.
 * @param {Array<string>} args - Arguments to the npm command.
 * @param {string} npmfs - The working directory to run the npm command in.
 * @return {Promise} A promise for the completion of the command.
 */
var execNpm = function execNpm(command, args, npmfs) {
    var deferred = Q.defer(),
        requestedPackage = null,
        procChild = null;

    if (Array.isArray(args) && args.length > 0) {
        requestedPackage = args[0];
    }

    switch (command) {
        case COMMANDS.VIEW:
            if (requestedPackage) {
                procChild = fork(__dirname + '/npm-view-command.js', [requestedPackage, npmfs]);
            }
            break;
        case COMMANDS.INSTALL:
            if (requestedPackage) {
                procChild = fork(__dirname + '/npm-install-command.js', [requestedPackage, npmfs]);
            }
            break;
        case COMMANDS.OUTDATED:
            procChild = fork(__dirname + '/npm-outdated-command.js', [npmfs]);
            break;
    }

    if (procChild) {
        var result = null;

        procChild.on('message', function (message) {
            result = message;
        });

        procChild.on('exit', function (code) {
            if (code !== 0) {
                deferred.reject(new Error("'npm " + command + " " + args.join(" ") + "' in " + npmfs + " exited with code " + code));
            } else {
                if (result) {
                    if (typeof result.error !== "undefined") {
                        deferred.reject(result.error);
                    } else {
                        deferred.resolve(result.response);
                    }
                } else {
                    deferred.resolve();
                }
            }
        });

    } else {
        deferred.reject(new Error("invalid npm command or missing arguments"));
    }

    return deferred.promise;
};

execNpm.COMMANDS = COMMANDS;

module.exports = execNpm;
