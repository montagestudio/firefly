var execNpm = require('../package-manager/exec-npm');

module.exports = PackageManagerService;

function PackageManagerService (fs, environment, pathname, fsPath) {
    // Returned service
    var service = {};

    service.gatherPackageInformation = function (requestedPackage) {
        return execNpm(execNpm.COMMANDS.VIEW, [requestedPackage], fsPath);
    };

    return service;
}
