/*global process,module*/

const PackageManagerTools = require("./package-manager-tools"),
    PackageManagerError = require("./package-manager-error"),
    PrepareNpmForExecution = require("./prepare-exec-npm"),
    Arguments = process.argv,
    Q = require("q"),

    ERROR_NOT_FOUND = 2000,
    ERROR_VERSION_NOT_FOUND = 2001,
    ERROR_WRONG_FORMAT = 2002,
    ERROR_UNKNOWN = 2003;

/**
 * Invokes the NPM install command.
 * @function
 * @param {Object} npmLoaded - A NPM instance loaded with its own configuration.
 * @param {String} ModulesRequested - Modules list to install,
 * each entry should respect the following format: "name[@version]".
 * @return {Promise.<Object>} A promise for the installed modules.
 * @private
 */
async function execCommand (npmLoaded, ModulesRequested) {
    let _request = null;
    if (typeof ModulesRequested === "string") {
        const modulesRequestedCollection = ModulesRequested.split(","),
            error = modulesRequestedCollection.some(function (moduleRequested) {
                return !PackageManagerTools.isRequestValid(moduleRequested);
            });
        if (!error) {
            _request = modulesRequestedCollection;
        }
    }
    if (_request) {
        try {
            const data = await Q.ninvoke(npmLoaded.commands, "install", _request);
            return _formatListModulesInstalled(data[1]);
        } catch (e) {
            let error = e;
            if (e && typeof e === 'object') {
                if (e.code === 'E404') {
                    error = new PackageManagerError("Dependency not found", ERROR_NOT_FOUND);
                } else if ((/version not found/).test(e.message)) {
                    error = new PackageManagerError("Version not found", ERROR_VERSION_NOT_FOUND);
                } else {
                    error = new PackageManagerError("Unexpected error " + e.code, ERROR_UNKNOWN);
                }
            }
            throw error;
        }
    }
    throw new PackageManagerError("Should respect the following format: name[@version], or a git url", ERROR_WRONG_FORMAT);
}

/**
 * Format a "NPM Install" response.
 * @function
 * @param {Object} listModules - A list of all the modules which have been installed.
 * @return {Array} A well formatted list of all the modules which have been installed.
 * @private
 */
async function _formatListModulesInstalled (listModules) {
    const listModulesInstalled = [];
    if (listModules && typeof listModules === 'object') {
        const listModulesKeys = Object.keys(listModules);
        listModulesKeys.forEach((moduleKeys) => {
            const moduleInstalled = listModules[moduleKeys],
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
    const request = Arguments[2],
        fsPath = Arguments[3];
    PrepareNpmForExecution(fsPath, request, execCommand);
}
