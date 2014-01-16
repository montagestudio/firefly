var listDependencies = require('../package-manager/list-dependencies');
var fileService = require('./file-service');
var RemovePackage = require('../package-manager/remove-package');
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

    service.removePackage= function (packageName) {
        return RemovePackage(FS, packageName, fsPath);
    };

    return service;
}
