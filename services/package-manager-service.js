var listDependencies = require('../package-manager/list-dependencies');
var execNpm = require('../package-manager/exec-npm');
var URL = require("url");

module.exports = PackageManagerService;

function PackageManagerService (fs, environment, pathname, fsPath) {
    // Returned service
    var service = {};

    function convertProjectUrlToPath (url) {
        return URL.parse(url).pathname;
    }

    service.listDependenciesAtUrl = function (url) {
        var path = convertProjectUrlToPath(url).replace(/package\.json$/, "");

        return listDependencies(fs, path);
    };

    service.gatherPackageInformation = function (requestedPackage) {
        return execNpm(execNpm.COMMANDS.VIEW, [requestedPackage], fsPath);
    };

    return service;
}
