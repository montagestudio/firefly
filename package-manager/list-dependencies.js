var DetectErrorDependencyTree = require("./detect-error-dependency-tree"),
    DependencyNode = require("./dependency-node"),
    PATH = require("path"),
    Q = require("q"),

    DEPENDENCY_CATEGORIES = DependencyNode.DEPENDENCY_CATEGORIES;

/**
 * Makes a "dependency tree" at a given path and will try to find some eventual errors.
 * @function
 * @param {Object} fs - a given fs module.
 * @param {String} projectPath - a file system path where to operate.
 * @param {Boolean} shouldReadChildren - Define if this process will get information deeply.
 * @return {Promise.<Object>} Promise for the "Dependency Tree" Object.
 */
module.exports = function listDependencies (fs, projectPath, shouldReadChildren) {

    var dependencyTree = new DependencyNode();
    dependencyTree.path = projectPath;
    shouldReadChildren = typeof shouldReadChildren === "undefined" ? true : shouldReadChildren;

    /**
     * Build the "Dependency Tree" Object.
     * @function
     * @return {Promise.<Object>} Promise for the "Dependency Tree" Object.
     */
    function buildDependencyTree () {
        return _examineDependencyNode(dependencyTree).then(function () {
            var jsonFile = dependencyTree.fileJsonRaw;

            if (jsonFile) {
                jsonFile.dependencies = jsonFile.dependencies || {};
                jsonFile.optionalDependencies = jsonFile.optionalDependencies || {};
                jsonFile.devDependencies = jsonFile.devDependencies || {};
                jsonFile.bundledDependencies = jsonFile.bundleDependencies || jsonFile.bundledDependencies || [];
            } else {
                dependencyTree.jsonFileMissing = true;
            }

            dependencyTree.missing = false;
            dependencyTree.version = dependencyTree.versionInstalled;
            dependencyTree.problems = DetectErrorDependencyTree(dependencyTree);

            _distributeProblemsToRootDependencyNode();

            return dependencyTree;
        });
    }

    /**
     * Examines a DependencyNode Object in order to find its information.
     * @function
     * @param {Object} dependencyNode - a DependencyNode Object.
     * @return {Promise.<Object>} Promise for a DependencyNode Object examined.
     */
    function _examineDependencyNode (dependencyNode) {
        var nodeModulesPath = PATH.join(dependencyNode.path, 'node_modules/');

        return _fillDependencyNodeByReadingItsPackageJsonFile(dependencyNode).then(function () {
            return _listInstalledDependenciesAtPath(nodeModulesPath).then(function (installedDependencies) {
                if (installedDependencies) {

                    installedDependencies.forEach(function (installedDependencyName) {
                        var dependencySaved = _findDependency(dependencyNode.children, installedDependencyName);

                        if (!!dependencySaved) {
                            dependencySaved.missing = false;
                        } else {
                            var dependencyExtraneous = new DependencyNode();

                            dependencyExtraneous.name = installedDependencyName;
                            dependencyExtraneous.missing = false;
                            dependencyExtraneous.parent = dependencyNode;
                            dependencyExtraneous.path = PATH.join(nodeModulesPath, installedDependencyName, "/");
                            dependencyExtraneous.type = DEPENDENCY_CATEGORIES.REGULAR;
                            dependencyExtraneous.extraneous = true;

                            dependencyNode.children.regular.push(dependencyExtraneous);
                        }
                    });
                }
            }, function () {}).then(function () {
                    if (shouldReadChildren) {
                        return _examineDependencyNodeChildren(dependencyNode);
                    }
                });
        });
    }

    /**
     * Fulfill a DependencyNode Object by reading its own package.json file.
     * @function
     * @param {Object} dependencyNode - a DependencyNode Object.
     * @return {Promise.<Object>} Promise for the dependencyNode fulfilled.
     */
    function _fillDependencyNodeByReadingItsPackageJsonFile (dependencyNode) {
        return _readPackageJsonFileAtDependencyPath(dependencyNode.path).then(function (packageJsonFileParsed) {
            if (packageJsonFileParsed) {
                dependencyNode.jsonFileError = !packageJsonFileParsed.name || !packageJsonFileParsed.version;

                if (!dependencyNode.jsonFileError) {
                    _updateDependencyNodeWithPackageJsonFileParsed(dependencyNode, packageJsonFileParsed);
                }
            } else {
                dependencyNode.jsonFileMissing = true;
            }
        }, function () {
            dependencyNode.jsonFileError = true;
        });
    }

    /**
     * Reads a package.json file at a given path.
     * @function
     * @param {String} dependencyPath - a dependency path.
     * @return {Promise.<Object>} Promise for the package.json file parsed.
     */
    function _readPackageJsonFileAtDependencyPath (dependencyPath) {
        var packageJsonFilePath = PATH.join(dependencyPath, 'package.json');

        return fs.exists(packageJsonFilePath).then(function (exists) {
            if (exists) {
                return fs.read(packageJsonFilePath).then(JSON.parse);
            }
        });
    }

    /**
     * Updates a DependencyNode Object with the content of a package.json file.
     * @function
     * @param {Object} dependencyNode - a DependencyNode Object.
     * @param {String} packageJsonFileParsed - a package.json file parsed.
     */
    function _updateDependencyNodeWithPackageJsonFileParsed (dependencyNode, packageJsonFileParsed) {
        dependencyNode.name = packageJsonFileParsed.name;
        dependencyNode.versionInstalled = packageJsonFileParsed.version;
        dependencyNode.private = !!packageJsonFileParsed.private;
        dependencyNode.bundled = packageJsonFileParsed.bundledDependencies || packageJsonFileParsed.bundleDependencies || [];

        if (dependencyNode.path === projectPath) {
            dependencyNode.fileJsonRaw = packageJsonFileParsed;
        }

        var children = null;

        if (packageJsonFileParsed.dependencies) {
            children = _formatListDependenciesRaw(packageJsonFileParsed.dependencies, dependencyNode, DEPENDENCY_CATEGORIES.REGULAR);
            dependencyNode.children.regular = children;
        }

        if (packageJsonFileParsed.optionalDependencies) {
            children = _formatListDependenciesRaw(packageJsonFileParsed.optionalDependencies, dependencyNode, DEPENDENCY_CATEGORIES.OPTIONAL);
            dependencyNode.children.optional = children;
        }

        if (packageJsonFileParsed.devDependencies) {
            children = _formatListDependenciesRaw(packageJsonFileParsed.devDependencies, dependencyNode, DEPENDENCY_CATEGORIES.DEV);
            dependencyNode.children.dev = children;
        }
    }

    /**
     * Formats a list of dependencies from a package.json file parsed.
     * @function
     * @param {String} listDependenciesRaw - a list of dependencies from a package.json file parsed.
     * @param {Object} dependencyNode - a DependencyNode Object.
     * @return {Array} list of DependencyNode Objects formatted.
     */
    function _formatListDependenciesRaw (listDependenciesRaw, dependencyNode, dependencyCategory) {
        var listDependencyNames = Object.keys(listDependenciesRaw),
            containerDependencies = [];

        listDependencyNames.forEach(function (dependencyName) {
            var tempDependencyNode = new DependencyNode();

            tempDependencyNode.name = dependencyName;
            tempDependencyNode.path = PATH.join(dependencyNode.path, 'node_modules/', dependencyName, "/");
            tempDependencyNode.parent = dependencyNode;
            tempDependencyNode.version = listDependenciesRaw[dependencyName];
            tempDependencyNode.type = dependencyCategory;

            containerDependencies.push(tempDependencyNode);
        });

        return containerDependencies;
    }

    /**
     * Returns a list of potentials dependency within a node_modules folders.
     * @function
     * @param {String} nodeModulesPath - a file system path where to operate.
     * @return {Array} list of dependencies.
     */
    function _listInstalledDependenciesAtPath (nodeModulesPath) {
        return fs.exists(nodeModulesPath).then(function (exists) {
            if (exists) {
                return fs.list(nodeModulesPath).then(function (fileNames) {
                    return _filterFolders(nodeModulesPath, fileNames);
                });
            }
        });
    }

    /**
     * Filter a list of file names by keeping just folders.
     * @function
     * @param {String} path - a file system path where to operate.
     * @param {Array} listFileNames - a list of file names.
     * @return {Array} list of folders.
     */
    function _filterFolders (path, listFileNames) {
        var folders = [];

        return Q.all(listFileNames.map(function (fileName) {
                return fs.stat(PATH.join(path, fileName)).then(function (stats) {
                    if (stats.isDirectory() && fileName.charAt(0) !== '.') {
                        folders.push(fileName);
                    }
                });
            })).then(function () {
                return folders;
            });
    }

    /**
     * Finds an DependencyNode Object within a list of dependencies.
     * @function
     * @param {Array} dependencies - a list of dependencies.
     * @param {String} dependencyName - a dependency name to find.
     * @param {Array} [_category] - the current "category" of dependencies that is traversed.
     * @return {(Object|null)}
     */
    function _findDependency (dependencies, dependencyName, _category) {
        var dependencyFound = null;

        if (_category) {
            var dependencyList = dependencies[_category],
                exists = dependencyList.some(function (dependency) {
                    dependencyFound = dependency;
                    return dependency.name === dependencyName;
                });

            return exists ? dependencyFound : null;
        }

        var categoriesDependencies = Object.keys(dependencies);

        categoriesDependencies.some(function (category) {
            dependencyFound = _findDependency(dependencies, dependencyName, category);
            return !!dependencyFound;
        });

        return dependencyFound;
    }

    /**
     * Examines the children of a DependencyNode Object.
     * @function
     * @param {Object} dependencyNode - a DependencyNode Object.
     * @return {Promise}
     */
    function _examineDependencyNodeChildren (dependencyNode) {
        var children = dependencyNode.children,
            childrenCategoryKeys = Object.keys(children);

        return Q.all(childrenCategoryKeys.map(function (childCategoryKey) {
            var childrenCategory = children[childCategoryKey];

            return Q.all(childrenCategory.map(function (childNode) {
                if (!childNode.missing) {
                    return _examineDependencyNode(childNode);
                }
            }));
        }));
    }

    function _distributeProblemsToRootDependencyNode () {
        var problems = dependencyTree.problems;

        if (Array.isArray(problems)) {
            problems.forEach(function (problem) {
                var rootDependencyNode = _findDependency(dependencyTree.children, problem.rootParent, problem.type);

                if (!Array.isArray(rootDependencyNode.problems)) {
                    rootDependencyNode.problems = [];
                }

                rootDependencyNode.problems.push(problem);
            });
        }
    }

    return buildDependencyTree();
};
