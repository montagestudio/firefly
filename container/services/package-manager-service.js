var listDependencies = require('../package-manager/list-dependencies');
var FileService = require('./file-service');
var RemovePackage = require('../package-manager/remove-package');
var SearchPackages = require('../package-manager/search-packages');
var PackageManagerTools = require('../package-manager/package-manager-tools');
var installPackages = require('../package-manager/install-packages');
var execNpm = require('../package-manager/exec-npm');

//FIXME use fs from the service once the function “removeTree” of QFS would have be fixed after having reroot it.
var FS = require("q-io/fs");

module.exports = PackageManagerService;

function PackageManagerService (session, fs, environment, pathname, fsPath) {
    // Returned service
    var service = {},

        CONF = {
            DEPENDENCY_CATEGORY_REQUIRED_PROJECT: {
                regular: true,
                dev: true,
                optional: false
            }
        };

    var convertProjectUrlToPath = FileService.makeConvertProjectUrlToPath(pathname);

    service.listDependenciesAtUrl = function (url) {
        var path = convertProjectUrlToPath(url);

        if (path) {
            path = path.replace(/package\.json$/, "");
        }

        return listDependencies(fs, path);
    };

    service.gatherPackageInformation = function (requestedPackage) {
        return execNpm(execNpm.COMMANDS.VIEW, requestedPackage, fsPath);
    };

    service.installPackages = function (requestedPackages) {
        return installPackages(requestedPackages, session.githubAccessToken, fsPath);
    };

    service.removePackage= function (packageName) {
        return RemovePackage(FS, packageName, fsPath);
    };

    service.findOutdatedDependency = function () {
        return execNpm(execNpm.COMMANDS.OUTDATED, null, fsPath);
    };

    function getDependenciesToInstall(dependencyList) {
        var dependenciesToInstall = [];

        if (dependencyList && typeof dependencyList === "object") {
            var allowed = CONF.DEPENDENCY_CATEGORY_REQUIRED_PROJECT;

            Object.keys(dependencyList).forEach(function (key) {
                var dependencyCategory = dependencyList[key];

                if (allowed[key] && Array.isArray(dependencyCategory)) {
                    dependenciesToInstall = dependenciesToInstall.concat(dependencyCategory);
                }
            });
        }

        return dependenciesToInstall;
    }

    service.installProjectPackages = function () {
        return listDependencies(fs, fs.ROOT, false).then(function (dependencyTree) {
            var dependenciesToInstall = getDependenciesToInstall(dependencyTree.children),
                requestedPackages = [];

            dependenciesToInstall.forEach(function (dependency) {
                if (dependency.missing) {
                    if (PackageManagerTools.isNpmCompatibleGitUrl(dependency.version)) {
                        requestedPackages.push(dependency.version);
                    } else {
                        requestedPackages.push(dependency.name);
                    }
                }
            });

            if (requestedPackages.length > 0) {
                return installPackages(requestedPackages, session.githubAccessToken, fsPath);
            }
        });
    };

    service.searchPackages = SearchPackages;

    return service;
}
