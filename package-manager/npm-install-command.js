/*global process,module*/

var PackageManagerTools = require("./package-manager-tools"),
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
 * @param {Object} npmLoaded represents the path where the package will be installed.
 * @param {String} request the package to install, should respect the following format: "name[@version]".
 * @return {Promise.<Object>} A promise for the installed package.
 * @private
 */
function execCommand (npmLoaded, request) {
    if (PackageManagerTools.isRequestValid(request)) {
        return Q.ninvoke(npmLoaded.commands, "install", [request]).then(function (data) { // packageLocation -> private API.
            return _formatResponse(data[1]);
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
 * Format the NPM response when the package installation is done.
 * @function
 * @param {Object} response contains all information about the installation.
 * @return {Object} a well formatted object containing all information about the installation.
 * @private
 */
function _formatResponse (response) {
    if (response && typeof response === 'object') {
        var keys = Object.keys(response),
            root = response[keys[0]];

        if (!root && typeof root !== 'object' && !root.hasOwnProperty('what')) {
            throw new PackageManagerError("Dependency not installed, error unknown", ERROR_UNKNOWN);
        }

        var information = PackageManagerTools.getModuleFromString(root.what);

        return {
            name: information.name || '',
            version: information.version || ''
        };
    }
}

if (require.main === module && Arguments.length === 4) {
    var request = Arguments[2],
        fsPath = Arguments[3];

    PrepareNpmForExecution(fsPath, request, execCommand);
}
