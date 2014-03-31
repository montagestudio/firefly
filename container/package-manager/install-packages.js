var PackageManagerTools = require("./package-manager-tools"),
    installPackageFromGitUrl = require("./install-package-url"),
    listDependencies = require("./list-dependencies"),
    Q = require("q"),
    FS = require("q-io/fs"),
    Path = require("path"),
    semver = require("semver"),
    execNpm = require('../package-manager/exec-npm');

module.exports = function installPackages (packages, gitHubAccessToken, fsPath, dependencyTree, currentDependency) {
    var _packagesFiltered = {
            npmPackages : [],
            gitPackages: []
        },

        _packagesInstalled = [],
        _dependencyTree = dependencyTree || null,
        _currentDependency = currentDependency || null,
        _regularDependencyCategory = 'regular';

    function _install () {
        return _buildDependencyTree().then(function () {
            _filterPackages(); // separate packages that can be installed from a git url or with npm.

            if (_packagesFiltered.npmPackages.length > 0) {
                return execNpm(execNpm.COMMANDS.INSTALL, _packagesFiltered.npmPackages, fsPath).then(function (packagesInstalled) {
                    _packagesInstalled = _packagesInstalled.concat(packagesInstalled);
                    _addDependenciesToDependencyNode(packagesInstalled);

                    return _installGitPackages(); // install eventual packages from a git url.
                });
            } else if (_packagesFiltered.gitPackages.length > 0) {
                return _installGitPackages();
            }

            throw new Error("no packages to install");
        });
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

                        var dependencyNodeInstalled = _addDependencyToDependencyNode(packageInstalled, _currentDependency),
                            packagesToInstall = _findPackagesToInstall(packageJson.children, dependencyNodeInstalled);

                        if (Array.isArray(packagesToInstall) && packagesToInstall.length > 0) {
                            return installPackages(packagesToInstall, gitHubAccessToken, pathToPackage, _dependencyTree, dependencyNodeInstalled);
                        }
                    });
                });
            }));
        }

        return void 0;
    }

    function _findPackagesToInstall (dependencyListRaw, dependencyNode) {
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
                if (!_searchSubstituteParentNode(dependencyNode, dependency.name, dependency.version)) {
                    dependenciesToInstall.push(dependency.name);
                }
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
            var module = PackageManagerTools.getModuleFromString(packageToInstall);

            if (module && !_searchSubstituteParentNode(_currentDependency, module.name, module.version)) {
                _packagesFiltered.npmPackages.push(packageToInstall); // packageName[@version]
            }
        }
    }

    function _buildDependencyTree () {
        if (!_currentDependency && !_dependencyTree) {
            return listDependencies(FS, fsPath, true).then(function (dependencyTree) {
                _currentDependency = _dependencyTree = {};
                _dependencyTree.name = dependencyTree.name;
                _dependencyTree.version = dependencyTree.version;
                _dependencyTree.children = {};

                Object.keys(dependencyTree.children).forEach(function (dependencyCategoryKey) {
                    var dependencyCategory = dependencyTree.children[dependencyCategoryKey];

                    for (var i = 0, length = dependencyCategory.length; i < length; i++) {
                        var dependency = dependencyCategory[i];

                        if (!dependency.missing) {
                            _addDependencyToDependencyNode({
                                name: dependency.name,
                                version: dependency.versionInstalled
                            }, _dependencyTree);
                        }
                    }
                });
            });
        }

        return Q.resolve(true);
    }

    function _addDependenciesToDependencyNode (dependencies) {
        if (Array.isArray(dependencies)) {
            dependencies.forEach(function (dependency) {
                _addDependencyToDependencyNode(dependency, _currentDependency);
            });
        }
    }

    function _addDependencyToDependencyNode (dependency, parentNode) {
        if (parentNode && dependency) {
            var dependencyNode = {
                name: dependency.name,
                version: dependency.version,
                children: {},
                parent: parentNode
            };

            parentNode.children[dependency.name] = dependencyNode;

            return dependencyNode;
        }
    }

    function _searchSubstituteParentNode (dependencyNode, dependencyName, dependencyRange) {
        if (dependencyNode && dependencyNode.parent) {
            var children = dependencyNode.parent.children,
                substituteParentNode = null;

            Object.keys(children).some(function (childKey) {
                var child = children[childKey];

                if (dependencyRange && child.name === dependencyName && semver.satisfies(child.version, dependencyRange, true)) {
                    substituteParentNode = child;
                }

                return !!substituteParentNode;
            });

            return substituteParentNode ? substituteParentNode : _searchSubstituteParentNode(dependencyNode.parent, dependencyName, dependencyRange);
        }

        return false;
    }

    return _install().then(function () {
        return _packagesInstalled;
    });
};
