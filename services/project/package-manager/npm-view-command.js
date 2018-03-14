/*global process,module*/

var PackageManagerTools = require("./package-manager-tools"),
    PackageManagerError = require("./package-manager-error"),
    PrepareNpmForExecution = require("./prepare-exec-npm"),
    Q = require("q"),
    Arguments = process.argv,

    ERROR_REQUEST_INVALID = 3001;

/**
 * Executes the NPM view command and gather some information about a NPM package.
 * @function
 * @param {Object} npmLoaded - A NPM instance loaded with its own configuration.
 * @param {Object} request - The requested package.
 * @return {Promise.<Object>} A promise for the requested module.
 * @private
 */
function execCommand (npmLoaded, request) {
    if (typeof request === 'string' && request.length > 0) {
        request = request.trim();

        if (PackageManagerTools.isRequestValid(request)) {
            return Q.ninvoke(npmLoaded.commands, "view", [request], true).then(function (packageInformationRaw) {

                if (packageInformationRaw && typeof packageInformationRaw === 'object') {
                    var packageInformationKeys = Object.keys(packageInformationRaw);

                    if (packageInformationKeys.length === 1) {
                        return _formatPackageInformationRaw(packageInformationRaw[packageInformationKeys[0]]);
                    }
                } // Can be undefined if the version doesn't exists.
            }, function (error) {
                if (error && typeof error === 'object' && error.code !== 'E404') { // the requested module can be private.
                    throw error;
                }
            });
        }
    }

    return Q.reject(new PackageManagerError("Wrong request should respect the following format: name[@version]", ERROR_REQUEST_INVALID));
}

/**
 * Formats the package information gathered from the NPM command.
 * @function
 * @param {Object} packageInformationRaw - Package information to format.
 * @return {Object} An well formatted Package Object.
 * @private
 */
function _formatPackageInformationRaw (packageInformationRaw) {
    var author = packageInformationRaw.author;

    return {
        name: packageInformationRaw.name || '',
        version: packageInformationRaw.version || '',
        versions: Array.isArray(packageInformationRaw.versions) ? packageInformationRaw.versions : [],
        author: typeof author === 'string' ? PackageManagerTools.formatPersonFromString(author) : author,
        description: packageInformationRaw.description || '',
        maintainers: PackageManagerTools.formatPersonsContainer(packageInformationRaw.maintainers),
        contributors: PackageManagerTools.formatPersonsContainer(packageInformationRaw.contributors),
        time: packageInformationRaw.time ? packageInformationRaw.time : null,
        homepage: packageInformationRaw.homepage || ''
    };
}

if (require.main === module && Arguments.length === 4) {
    var request = Arguments[2],
        fsPath = Arguments[3];

    PrepareNpmForExecution(fsPath, request, execCommand);
}
