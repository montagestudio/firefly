const PackageManagerError = require("./package-manager-error"),
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
async function RemovePackage(fs, dependencyName, dependencyLocation) {
    if (typeof dependencyName === 'string' && dependencyName.length > 0) {
        if (typeof dependencyLocation === 'string' && dependencyLocation.length > 0) {
            dependencyName = dependencyName.trim();
            if (!(/\/node_modules$/).test(dependencyLocation)) {
                dependencyLocation = path.join(dependencyLocation, 'node_modules/');
            }
            try {
                await fs.removeTree(path.join(dependencyLocation, dependencyName));
                return { name: dependencyName };
            } catch (error) {
                if (error.errno === 3) {
                    const wrongPermission = "Error filesystem permissions cannot remove while the dependency named " + dependencyName;
                    throw new PackageManagerError(wrongPermission, ERRORS.FS_PERMISSION);
                } else if (error.errno === 34 || error.code === "ENOENT") {
                    const folderNotFound = "Dependency named " + dependencyName + " has not been found on the filesystem";
                    throw new PackageManagerError(folderNotFound, ERRORS.DEPENDENCY_NOT_FOUND);
                }
                throw error;
            }
        }
        throw new PackageManagerError("Dependency path invalid", ERRORS.PROJECT_PATH_NOT_VALID);
    }
    throw new PackageManagerError("Dependency name invalid", ERRORS.DEPENDENCY_NAME_NOT_VALID);
}

RemovePackage.ERRORS = ERRORS;

module.exports = RemovePackage;
