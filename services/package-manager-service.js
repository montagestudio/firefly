var listDependencies = require('../package-manager/list-dependencies');
var fileService = require('./file-service');
var execNpm = require('../package-manager/exec-npm');
var URL = require("url");

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

    return service;
}
