const DetectErrorDependencyTree = require("./detect-error-dependency-tree"),
    makeDependencyNode = require("./dependency-node"),
    PATH = require("path"),
    Q = require("q"),
    DEPENDENCY_CATEGORIES = makeDependencyNode.DEPENDENCY_CATEGORIES;

/**
 * Makes a "dependency tree" at a given path and will try to find some eventual errors.
 * @function
 * @param {Object} fs - a given fs module.
 * @param {String} projectPath - a file system path where to operate.
 * @param {Boolean} shouldReadChildren - Define if this process will get information deeply.
 * @return {Promise.<Object>} Promise for the "Dependency Tree" Object.
 */
module.exports = function listDependencies(fs, projectPath, shouldReadChildren) {
    const dependencyTree = makeDependencyNode();
    let rootExamined = false;

    dependencyTree.path = projectPath;
    shouldReadChildren = typeof shouldReadChildren === "undefined" ? true : shouldReadChildren;

    /**
     * Build the "Dependency Tree" Object.
     * @function
     * @return {Promise.<Object>} Promise for the "Dependency Tree" Object.
     */
    async function buildDependencyTree () {
        await _examineDependencyNode(dependencyTree);
        const jsonFile = dependencyTree.fileJsonRaw;
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
    }

    /**
     * Examines a DependencyNode Object in order to find its information.
     * @function
     * @param {Object} dependencyNode - a DependencyNode Object.
     * @return {Promise.<Object>} Promise for a DependencyNode Object examined.
     */
    async function _examineDependencyNode (dependencyNode) {
        const nodeModulesPath = PATH.join(dependencyNode.path, 'node_modules/');
        let installedDependencies;
        try {
            await _fillDependencyNodeByReadingItsPackageJsonFile(dependencyNode);
            installedDependencies = await _listInstalledDependenciesAtPath(nodeModulesPath);
        } catch (err) {}
        if (installedDependencies) {
            installedDependencies.forEach((installedDependencyName) => {
                const dependencySaved = _findDependency(dependencyNode.children, installedDependencyName);
                if (dependencySaved) {
                    dependencySaved.missing = false;
                } else {
                    const dependencyExtraneous = makeDependencyNode();
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
        if (shouldReadChildren) {
            return _examineDependencyNodeChildren(dependencyNode);
        }
    }

    /**
     * Fulfill a DependencyNode Object by reading its own package.json file.
     * @function
     * @param {Object} dependencyNode - a DependencyNode Object.
     * @return {Promise.<Object>} Promise for the dependencyNode fulfilled.
     */
    async function _fillDependencyNodeByReadingItsPackageJsonFile(dependencyNode) {
        try {
            const packageJsonFileParsed = await _readPackageJsonFileAtDependencyPath(dependencyNode.path);
            if (packageJsonFileParsed) {
                dependencyNode.jsonFileError = !packageJsonFileParsed.name || !packageJsonFileParsed.version;
                if (!dependencyNode.jsonFileError) {
                    _updateDependencyNodeWithPackageJsonFileParsed(dependencyNode, packageJsonFileParsed);
                }
            } else {
                dependencyNode.jsonFileMissing = true;
            }
        } catch (err) {
            dependencyNode.jsonFileError = true;
        }
    }

    /**
     * Reads a package.json file at a given path.
     * @function
     * @param {String} dependencyPath - a dependency path.
     * @return {Promise.<Object>} Promise for the package.json file parsed.
     */
    async function _readPackageJsonFileAtDependencyPath(dependencyPath) {
        const packageJsonFilePath = PATH.join(dependencyPath, 'package.json');
        const exists = await fs.exists(packageJsonFilePath);
        if (exists) {
            const packageJsonRaw = await fs.read(packageJsonFilePath);
            if (!rootExamined) {
                dependencyTree.endLine = /\}\n+$/.test(packageJsonRaw);
                rootExamined = true;
            }
            return JSON.parse(packageJsonRaw);
        }
    }

    /**
     * Updates a DependencyNode Object with the content of a package.json file.
     * @function
     * @param {Object} dependencyNode - a DependencyNode Object.
     * @param {String} packageJsonFileParsed - a package.json file parsed.
     */
    function _updateDependencyNodeWithPackageJsonFileParsed(dependencyNode, packageJsonFileParsed) {
        dependencyNode.name = packageJsonFileParsed.name;
        dependencyNode.versionInstalled = packageJsonFileParsed.version;
        dependencyNode.private = !!packageJsonFileParsed.private;
        dependencyNode.bundled = packageJsonFileParsed.bundledDependencies || packageJsonFileParsed.bundleDependencies || [];
        if (dependencyNode.path === projectPath) {
            dependencyNode.fileJsonRaw = packageJsonFileParsed;
        }
        let children = null;
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
    function _formatListDependenciesRaw(listDependenciesRaw, dependencyNode, dependencyCategory) {
        const listDependencyNames = Object.keys(listDependenciesRaw),
            containerDependencies = [];
        listDependencyNames.forEach((dependencyName) => {
            const tempDependencyNode = makeDependencyNode();
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
    async function _listInstalledDependenciesAtPath(nodeModulesPath) {
        const exists = await fs.exists(nodeModulesPath);
        if (exists) {
            const fileNames = await fs.list(nodeModulesPath);
            return _filterFolders(nodeModulesPath, fileNames);
        }
    }

    /**
     * Filter a list of file names by keeping just folders.
     * @function
     * @param {String} path - a file system path where to operate.
     * @param {Array} listFileNames - a list of file names.
     * @return {Array} list of folders.
     */
    async function _filterFolders(path, listFileNames) {
        const folders = [];
        await Promise.all(listFileNames.map(async (fileName) => {
            const stats = await fs.stat(PATH.join(path, fileName));
            if (stats.isDirectory() && fileName.charAt(0) !== '.') {
                folders.push(fileName);
            }
        }));
        return folders;
    }

    /**
     * Finds an DependencyNode Object within a list of dependencies.
     * @function
     * @param {Array} dependencies - a list of dependencies.
     * @param {String} dependencyName - a dependency name to find.
     * @param {Array} [_category] - the current "category" of dependencies that is traversed.
     * @return {(Object|null)}
     */
    function _findDependency(dependencies, dependencyName, _category) {
        let dependencyFound = null;
        if (_category) {
            const dependencyList = dependencies[_category],
                exists = dependencyList.some((dependency) => {
                    dependencyFound = dependency;
                    return dependency.name === dependencyName;
                });
            return exists ? dependencyFound : null;
        }
        const categoriesDependencies = Object.keys(dependencies);
        categoriesDependencies.some((category) => {
            dependencyFound = _findDependency(dependencies, dependencyName, category);
            return dependencyFound;
        });
        return dependencyFound;
    }

    /**
     * Examines the children of a DependencyNode Object.
     * @function
     * @param {Object} dependencyNode - a DependencyNode Object.
     * @return {Promise}
     */
    function _examineDependencyNodeChildren(dependencyNode) {
        const children = dependencyNode.children,
            childrenCategoryKeys = Object.keys(children);

        return Promise.all(childrenCategoryKeys.map(async (childCategoryKey) => {
            const childrenCategory = children[childCategoryKey];
            await Q.all(childrenCategory.map(async (childNode) => {
                if (!childNode.missing) {
                    return _examineDependencyNode(childNode);
                }
            }));
        }));
    }

    function _distributeProblemsToRootDependencyNode() {
        const problems = dependencyTree.problems;
        if (Array.isArray(problems)) {
            problems.forEach((problem) => {
                const rootDependencyNode = _findDependency(dependencyTree.children, problem.rootParent);
                if (rootDependencyNode) {
                    if (!Array.isArray(rootDependencyNode.problems)) {
                        rootDependencyNode.problems = [];
                    }
                    rootDependencyNode.problems.push(problem);
                }
            });
        }
    }

    return buildDependencyTree();
};
