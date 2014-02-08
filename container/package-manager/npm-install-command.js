/*global process,module*/

var PackageManagerTools = require("./package-manager-tools"),
    PackageManagerError = require("./package-manager-error"),
    PrepareNpmForExecution = require("./prepare-exec-npm"),
    Arguments = process.argv,
    Q = require("q"),

    ERROR_NOT_FOUND = 2000,
    ERROR_VERSION_NOT_FOUND = 2001,
    ERROR_WRONG_FORMAT = 2002;

/**
 * Invokes the NPM install command.
 * @function
 * @param {Object} npmLoaded - A NPM instance loaded with its own configuration.
 * @param {String} ModulesRequested - Modules list to install,
 * each entry should respect the following format: "name[@version]".
 * @return {Promise.<Object>} A promise for the installed modules.
 * @private
 */
function execCommand (npmLoaded, ModulesRequested) {
    var _request = null;

    if (typeof ModulesRequested === "string") {
        var modulesRequestedCollection = ModulesRequested.split(","),

            error = modulesRequestedCollection.some(function (moduleRequested) {
                return !PackageManagerTools.isRequestValid(moduleRequested);
            });

        if (!error) {
            _request = modulesRequestedCollection;
        }
    }

    if (_request) {
        return Q.ninvoke(npmLoaded.commands, "install", _request).then(function (data) {
            return _formatListModulesInstalled(data[1]);
        }, function (error) {
            if (error && typeof error === 'object') {
                if (error.code === 'E404') {
                    error = new PackageManagerError("Dependency not found", ERROR_NOT_FOUND);
                } else if ((/version not found/).test(error.message)) {
                    error = new PackageManagerError("Version not found", ERROR_VERSION_NOT_FOUND);
                }
            }

            throw error;
        });
    }

    return Q.reject(
        new PackageManagerError("Should respect the following format: name[@version], or a git url", ERROR_WRONG_FORMAT)
    );
}

/**
 * Format a "NPM Install" response.
 * @function
 * @param {Object} listModules - A list of all the modules which have been installed.
 * @return {Array} A well formatted list of all the modules which have been installed.
 * @private
 */
function _formatListModulesInstalled (listModules) {
    var listModulesInstalled = [];

    if (listModules && typeof listModules === 'object') {
        var listModulesKeys = Object.keys(listModules);

        listModulesKeys.forEach(function (moduleKeys) {
            var moduleInstalled = listModules[moduleKeys],
                information = PackageManagerTools.getModuleFromString(moduleInstalled.what);

            listModulesInstalled.push({
                name: information.name || '',
                version: information.version || ''
            });
        });
    }

    return listModulesInstalled;
}

if (require.main === module && Arguments.length === 4) {
    var request = Arguments[2],
        fsPath = Arguments[3];

    PrepareNpmForExecution(fsPath, request, execCommand);
}
