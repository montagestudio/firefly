var listDependencies = require('../package-manager/list-dependencies');
var execNpm = require('../package-manager/exec-npm');

module.exports = PackageManagerService;

function PackageManagerService (fs, environment, pathname, fsPath) {
    // Returned service
    var service = {};

    service.listDependencies = function () {
        return listDependencies(fs, fs.ROOT);
    };

    service.gatherPackageInformation = function (requestedPackage) {
        return execNpm(execNpm.COMMANDS.VIEW, [requestedPackage], fsPath);
    };

    return service;
}
