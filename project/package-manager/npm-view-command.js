/*global process,module*/

const PackageManagerTools = require("./package-manager-tools"),
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
async function execCommand(npmLoaded, request) {
    if (typeof request === 'string' && request.length > 0) {
        request = request.trim();
        if (PackageManagerTools.isRequestValid(request)) {
            try {
                const packageInformationRaw = await Q.ninvoke(npmLoaded.commands, "view", [request], true);
                if (packageInformationRaw && typeof packageInformationRaw === 'object') {
                    const packageInformationKeys = Object.keys(packageInformationRaw);
                    if (packageInformationKeys.length === 1) {
                        return _formatPackageInformationRaw(packageInformationRaw[packageInformationKeys[0]]);
                    }
                } // Can be undefined if the version doesn't exists.
            } catch (error) {
                if (error && typeof error === 'object' && error.code !== 'E404') { // the requested module can be private.
                    throw error;
                }
            }
        }
    }
    throw new PackageManagerError("Wrong request should respect the following format: name[@version]", ERROR_REQUEST_INVALID);
}

/**
 * Formats the package information gathered from the NPM command.
 * @function
 * @param {Object} packageInformationRaw - Package information to format.
 * @return {Object} An well formatted Package Object.
 * @private
 */
function _formatPackageInformationRaw(packageInformationRaw) {
    const author = packageInformationRaw.author;
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
    const request = Arguments[2],
        fsPath = Arguments[3];
    PrepareNpmForExecution(fsPath, request, execCommand);
}
