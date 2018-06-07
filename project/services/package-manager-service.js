const listDependencies = require('../package-manager/list-dependencies');
const FileService = require('./file-service');
const RemovePackage = require('../package-manager/remove-package');
const SearchPackages = require('../package-manager/search-packages');
const execNpm = require('../package-manager/exec-npm');

//FIXME use fs from the service once the function “removeTree” of QFS would have be fixed after having reroot it.
const FS = require("q-io/fs");

module.exports = PackageManagerService;

function PackageManagerService (_, fs, pathname, fsPath) {
    // Returned service
    const CONF = {
        DEPENDENCY_CATEGORY_REQUIRED_PROJECT: {
            regular: true,
            dev: true,
            optional: false
        }
    };

    const convertProjectUrlToPath = FileService.makeConvertProjectUrlToPath(pathname);

    function getDependenciesToInstall(dependencyList) {
        let dependenciesToInstall = [];
        if (dependencyList && typeof dependencyList === "object") {
            const allowed = CONF.DEPENDENCY_CATEGORY_REQUIRED_PROJECT;
            Object.keys(dependencyList).forEach((key) => {
                const dependencyCategory = dependencyList[key];
                if (allowed[key] && Array.isArray(dependencyCategory)) {
                    dependenciesToInstall = dependenciesToInstall.concat(dependencyCategory);
                }
            });
        }
        return dependenciesToInstall;
    }

    const service = {
        async listDependenciesAtUrl(url) {
            let path = convertProjectUrlToPath(url);
            if (path) {
                path = path.replace(/package\.json$/, "");
            }
            return listDependencies(fs, path);
        },

        async gatherPackageInformation(requestedPackage) {
            return execNpm(execNpm.COMMANDS.VIEW, requestedPackage, fsPath);
        },

        async installPackages(requestedPackages) {
            return execNpm(execNpm.COMMANDS.INSTALL, requestedPackages, fsPath);
        },

        async removePackage(packageName) {
            return RemovePackage(FS, packageName, fsPath);
        },

        async findOutdatedDependency() {
            return execNpm(execNpm.COMMANDS.OUTDATED, null, fsPath);
        },

        async installProjectPackages() {
            const dependencyTree = await listDependencies(fs, fs.ROOT, false);
            const dependenciesToInstall = getDependenciesToInstall(dependencyTree.children),
                requestedPackages = [];
            dependenciesToInstall.forEach(function (dependency) {
                if (dependency.missing) {
                    requestedPackages.push(dependency.name);
                }
            });
            if (requestedPackages.length > 0) {
                return execNpm(execNpm.COMMANDS.INSTALL, requestedPackages, fsPath);
            }
        }
    };
    service.searchPackages = SearchPackages;
    return service;
}
