'use strict';

const PackageManagerTools = require("./package-manager-tools");
const PackageManagerError = require("./package-manager-error");

const ERROR_REQUEST_INVALID = 3001;

/**
 * Executes the NPM view command and gather some information about a NPM package.
 * @function
 * @param {Object} npm - A NPM instance loaded with its own configuration.
 * @param {Object} request - The requested package.
 * @return {Promise.<Object>} A promise for the requested module.
 * @private
 */
function view(npm, request) {
    request = request && request.trim();
    return new Promise((resolve, reject) => {
        if (request && request.length > 0 && PackageManagerTools.isRequestValid(request)) {
            npm.commands.view([request], true, (err, packageInformationRaw) => {
                if (err && err.code !== 'E404') { // the requested module can be private
                    reject(err);
                } else if (packageInformationRaw && typeof packageInformationRaw === 'object') {
                    const packageInformationKeys = Object.keys(packageInformationRaw);
                    if (packageInformationKeys.length === 1) {
                        resolve(_formatPackageInformationRaw(packageInformationRaw[packageInformationKeys[0]]));
                    }
                } else {
                    resolve();
                }
            });
        } else {
            reject(new PackageManagerError("Wrong request should respect the following format: name[@version]", ERROR_REQUEST_INVALID));
        }
    });
}
module.exports = view;

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
