var listDependencies = require('../package-manager/list-dependencies');
var fileService = require('./file-service');
var RemovePackage = require('../package-manager/remove-package');
var SearchPackages = require('../package-manager/search-packages');
var execNpm = require('../package-manager/exec-npm');

//FIXME use fs from the service once the function “removeTree” of QFS would have be fixed after having reroot it.
var FS = require("q-io/fs");

module.exports = PackageManagerService;

function PackageManagerService (fs, environment, pathname, fsPath) {
    // Returned service
    var service = {};

    service.listDependenciesAtUrl = function (url) {
        var path = fileService.convertProjectUrlToPath(url);

        if (path) {
            path = path.replace(/package\.json$/, "");
        }

        return listDependencies(fs, path);
    };

    service.gatherPackageInformation = function (requestedPackage) {
        return execNpm(execNpm.COMMANDS.VIEW, [requestedPackage], fsPath);
    };

    service.installPackage = function (requestedPackage) {
        return execNpm(execNpm.COMMANDS.INSTALL, [requestedPackage], fsPath);
    };

    service.removePackage= function (packageName) {
        return RemovePackage(FS, packageName, fsPath);
    };

    service.findOutdatedDependency = function () {
        return execNpm(execNpm.COMMANDS.OUTDATED, null, fsPath);
    };

    service.searchPackages = SearchPackages;

    return service;
}
