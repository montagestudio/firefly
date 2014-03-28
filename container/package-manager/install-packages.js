var PackageManagerTools = require("./package-manager-tools"),
    installPackageFromGitUrl = require("./install-package-url"),
    listDependencies = require("./list-dependencies"),
    Q = require("q"),
    FS = require("q-io/fs"),
    Path = require("path"),
    execNpm = require('../package-manager/exec-npm');

module.exports = function installPackages (packages, gitHubAccessToken, fsPath) {
    var _packagesFiltered = {
            npmPackages : [],
            gitPackages: []
        },

        _packagesInstalled = [],

        _regularDependencyCategory = 'regular';

    function _install () {
        _filterPackages(); // separate packages that can be installed from a git url or with npm.

        if (_packagesFiltered.npmPackages.length > 0) {
            return execNpm(execNpm.COMMANDS.INSTALL, _packagesFiltered.npmPackages, fsPath).then(function (packagesInstalled) {
                _packagesInstalled = _packagesInstalled.concat(packagesInstalled);

                return _installGitPackages(); // install eventual packages from a git url.
            });
        } else if (_packagesFiltered.gitPackages.length > 0) {
            return _installGitPackages();
        }

        return Q.reject(new Error("no packages to install"));
    }

    function _installGitPackages () {
        if (_packagesFiltered.gitPackages.length > 0) {
            return Q.all(_packagesFiltered.gitPackages.map(function (url) {
                return installPackageFromGitUrl(url, gitHubAccessToken, fsPath).then(function (packageInstalled) { // clone package
                    var pathToPackage = Path.join(fsPath, "node_modules", packageInstalled.name);

                    // Read package.json file from the recent cloned package,
                    // in order to determine if we need to install other dependencies.
                    return listDependencies(FS, pathToPackage, false).then(function (packageJson) {
                        if (packageJson.name !== packageInstalled.name) { // package name can be different from the folder name.
                            packageInstalled.name = packageJson.name;
                        }

                        _packagesInstalled.push(packageInstalled);

                        var packagesToInstall = _findPackagesToInstall(packageJson.children);

                        if (Array.isArray(packagesToInstall) && packagesToInstall.length > 0) {
                            return installPackages(packagesToInstall, gitHubAccessToken, pathToPackage);
                        }
                    });
                });
            }));
        }

        return void 0;
    }

    function _findPackagesToInstall (dependencyListRaw) {
        var dependencyList = [],
            dependenciesToInstall = [];

        Object.keys(dependencyListRaw).forEach(function (key) {
            var dependencyCategory = dependencyListRaw[key];

            if (key === _regularDependencyCategory && Array.isArray(dependencyCategory)) { // install just regular dependencies
                dependencyList = dependencyList.concat(dependencyCategory);
            }
        });

        dependencyList.forEach(function (dependency) {
            if (PackageManagerTools.isNpmCompatibleGitUrl(dependency.version)) {
                dependenciesToInstall.push(dependency.version);
            } else {
                dependenciesToInstall.push(dependency.name);
            }
        });

        return dependenciesToInstall;
    }

    function _filterPackages () {
        if (Array.isArray(packages)) {
            packages.forEach(function (packageToInstall) {
                _filterPackage(packageToInstall);
            });
        } else if (typeof packages === "string") {
            _filterPackage(packages);
        }
    }

    function _filterPackage (packageToInstall) {
        if (PackageManagerTools.isNpmCompatibleGitUrl(packageToInstall)) { // git url
            _packagesFiltered.gitPackages.push(packageToInstall);
        } else {
            _packagesFiltered.npmPackages.push(packageToInstall); // packageName[@version]
        }
    }

    return _install().then(function () {
        return _packagesInstalled;
    });
};
