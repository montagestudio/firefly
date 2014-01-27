var listDependencies = require('../package-manager/list-dependencies');
var FileService = require('./file-service');
var RemovePackage = require('../package-manager/remove-package');
var SearchPackages = require('../package-manager/search-packages');
var execNpm = require('../package-manager/exec-npm');
var Q = require('q');

//FIXME use fs from the service once the function “removeTree” of QFS would have be fixed after having reroot it.
var FS = require("q-io/fs");

module.exports = PackageManagerService;

function PackageManagerService (fs, environment, pathname, fsPath) {
    // Returned service
    var service = {};

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
        return execNpm(execNpm.COMMANDS.INSTALL, requestedPackages, fsPath);
    };

    service.removePackage= function (packageName) {
        return RemovePackage(FS, packageName, fsPath);
    };

    service.findOutdatedDependency = function () {
        return execNpm(execNpm.COMMANDS.OUTDATED, null, fsPath);
    };

    service.installProjectPackages = function () {
        return listDependencies(fs, fs.ROOT, true).then(function (dependencyTree) {
            var dependenciesToInstall = dependencyTree.children.regular,
                requestedPackages = dependenciesToInstall.filter(function (dependency) {
                    return dependency.missing;
                });

            return execNpm(execNpm.COMMANDS.INSTALL, requestedPackages, fsPath);
        });
    };

    service.searchPackages = SearchPackages;

    return service;
}
