var PackageManagerError = require("./package-manager-error"),
    path = require("path"),

    ERRORS = {
        DEPENDENCY_NAME_NOT_VALID: 4000,
        PROJECT_PATH_NOT_VALID: 4001,
        FS_PERMISSION: 4002,
        DEPENDENCY_NOT_FOUND: 4003
    };

/**
 * Remove a node module from the filesystem.
 * @function
 * @param {String} fs Dependency name.
 * @param {String} dependencyName Dependency name.
 * @param {boolean} dependencyLocation represents the file system path where to operate.
 * @return {Promise.<Object>} Promise for the removed dependency.
 */
var RemovePackage = function RemovePackage (fs, dependencyName, dependencyLocation) {
    if (!dependencyName || dependencyName.length === 0) {
        return Promise.reject(new PackageManagerError("Dependency name invalid", ERRORS.DEPENDENCY_NAME_NOT_VALID));
    }
    if (!dependencyLocation || dependencyLocation.length === 0) {
        return Promise.reject(new PackageManagerError("Dependency path invalid", ERRORS.PROJECT_PATH_NOT_VALID));
    }

    dependencyName = dependencyName.trim();

    if (!(/\/node_modules$/).test(dependencyLocation)) {
        dependencyLocation = path.join(dependencyLocation, 'node_modules/');
    }

    return fs.removeTree(path.join(dependencyLocation, dependencyName)).then(function () {
        return {name: dependencyName};
    }, function (error) {
        if (error.errno === 3) {
            var wrongPermission = "Error filesystem permissions cannot remove while the dependency named " + dependencyName;
            throw new PackageManagerError(wrongPermission, ERRORS.FS_PERMISSION);
        } else {
            var folderNotFound = "Dependency named " + dependencyName + " has not been found on the filesystem";
            throw new PackageManagerError(folderNotFound, ERRORS.DEPENDENCY_NOT_FOUND);
        }
    });
};

RemovePackage.ERRORS = ERRORS;

module.exports = RemovePackage;
