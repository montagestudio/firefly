/*global __dirname */
const log = require("logging").from(__filename),
    fork = require('child_process').fork,
    Q = require("q"),

    COMMANDS = {
        VIEW: 'view',
        INSTALL: 'install',
        OUTDATED: 'outdated'
    };

/**
 * Wrap executing the npm command in a promise.
 * @param {String} command - The npm command to execute.
 * @param {String|Array<String>} args - Arguments for the npm command.
 * @param {String} npmfs - The working directory to run the npm command in.
 * @return {Promise} A promise for the completion of the command.
 */
const execNpm = function execNpm(command, args, npmfs) {
    log(command, args);
    const deferred = Q.defer();
    let procChild = null;
    if (Array.isArray(args)) {
        args = args.join(",");
    }
    switch (command) {
        case COMMANDS.VIEW:
            if (args) {
                procChild = fork(__dirname + '/npm-view-command.js', [args, npmfs]);
            }
            break;
        case COMMANDS.INSTALL:
            if (args) {
                procChild = fork(__dirname + '/npm-install-command.js', [args, npmfs]);
            }
            break;
        case COMMANDS.OUTDATED:
            procChild = fork(__dirname + '/npm-outdated-command.js', [npmfs]);
            break;
    }

    if (procChild) {
        let result = null;
        procChild.on('message', (message) => result = message);
        procChild.on("error", (error) => deferred.reject(error));
        procChild.on('exit', (code) => {
            if (code !== 0) {
                const argumentList = typeof args === "string" ? args.replace(/,/g, " ") : "";
                deferred.reject(new Error("'npm " + command + " " + argumentList + "' in " + npmfs + " exited with code " + code));
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
