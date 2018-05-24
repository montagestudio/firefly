const DetectErrorDependencyTree = require("./detect-error-dependency-tree");
const makeDependencyNode = require("./dependency-node");
const PATH = require("path");
const { promisify } = require("util");

const { DEPENDENCY_CATEGORIES } = makeDependencyNode;

/**
 * Makes a "dependency tree" at a given path and will try to find some eventual errors.
 * @function
 * @param {Object} fs - a given fs module.
 * @param {String} projectPath - a file system path where to operate.
 * @param {Boolean} shouldReadChildren - Define if this process will get information deeply.
 * @return {Promise.<Object>} Promise for the "Dependency Tree" Object.
 */
module.exports = async function listDependencies(fs, projectPath, shouldReadChildren = true) {
    const dependencyTree = makeDependencyNode();
    let rootExamined = false;

    const fsAccessAsync = promisify(fs.access);
    const fsReaddirAsync = promisify(fs.readdir);
    const fsStatAsync = promisify(fs.stat);
    const fsReadFileAsync = promisify(fs.readFile);

    dependencyTree.path = projectPath;

    /**
     * Build the "Dependency Tree" Object.
     * @function
     * @return {Promise.<Object>} Promise for the "Dependency Tree" Object.
     */
    async function buildDependencyTree () {
        await examineDependencyNode(dependencyTree);
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
        distributeProblemsToRootDependencyNode();
        return dependencyTree;
    }

    /**
     * Examines a DependencyNode Object in order to find its information.
     * @function
     * @param {Object} dependencyNode - a DependencyNode Object.
     * @return {Promise.<Object>} Promise for a DependencyNode Object examined.
     */
    async function examineDependencyNode (dependencyNode) {
        var nodeModulesPath = PATH.join(dependencyNode.path, 'node_modules/');

        await fillDependencyNodeByReadingItsPackageJsonFile(dependencyNode);
        try {
            const installedDependencies = await listInstalledDependenciesAtPath(nodeModulesPath);
            if (installedDependencies) {
                installedDependencies.forEach((installedDependencyName) => {
                    const dependencySaved = findDependency(dependencyNode.children, installedDependencyName);
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
        } catch (e) {}
        if (shouldReadChildren) {
            return examineDependencyNodeChildren(dependencyNode);
        }
    }

    /**
     * Fulfill a DependencyNode Object by reading its own package.json file.
     * @function
     * @param {Object} dependencyNode - a DependencyNode Object.
     * @return {Promise.<Object>} Promise for the dependencyNode fulfilled.
     */
    async function fillDependencyNodeByReadingItsPackageJsonFile(dependencyNode) {
        try {
            const packageJsonFileParsed = await readPackageJsonFileAtDependencyPath(dependencyNode.path);
            if (packageJsonFileParsed) {
                dependencyNode.jsonFileError = !packageJsonFileParsed.name || !packageJsonFileParsed.version;
                if (!dependencyNode.jsonFileError) {
                    updateDependencyNodeWithPackageJsonFileParsed(dependencyNode, packageJsonFileParsed);
                }
            } else {
                dependencyNode.jsonFileMissing = true;
            }
        } catch (e) {
            dependencyNode.jsonFileError = true;
        }
    }

    /**
     * Reads a package.json file at a given path.
     * @function
     * @param {String} dependencyPath - a dependency path.
     * @return {Promise.<Object>} Promise for the package.json file parsed.
     */
    async function readPackageJsonFileAtDependencyPath(dependencyPath) {
        const packageJsonFilePath = PATH.join(dependencyPath, 'package.json');
        try {
            await fsAccessAsync(packageJsonFilePath);
            const packageJsonRaw = await fsReadFileAsync(packageJsonFilePath);
            if (!rootExamined) {
                dependencyTree.endLine = /\}\n+$/.test(packageJsonRaw);
                rootExamined = true;
            }
            return JSON.parse(packageJsonRaw);
        } catch (e) {}
    }

    /**
     * Updates a DependencyNode Object with the content of a package.json file.
     * @function
     * @param {Object} dependencyNode - a DependencyNode Object.
     * @param {String} packageJsonFileParsed - a package.json file parsed.
     */
    function updateDependencyNodeWithPackageJsonFileParsed (dependencyNode, packageJsonFileParsed) {
        dependencyNode.name = packageJsonFileParsed.name;
        dependencyNode.versionInstalled = packageJsonFileParsed.version;
        dependencyNode.private = !!packageJsonFileParsed.private;
        dependencyNode.bundled = packageJsonFileParsed.bundledDependencies || packageJsonFileParsed.bundleDependencies || [];
        if (dependencyNode.path === projectPath) {
            dependencyNode.fileJsonRaw = packageJsonFileParsed;
        }
        let children = null;
        if (packageJsonFileParsed.dependencies) {
            children = formatListDependenciesRaw(packageJsonFileParsed.dependencies, dependencyNode, DEPENDENCY_CATEGORIES.REGULAR);
            dependencyNode.children.regular = children;
        }
        if (packageJsonFileParsed.optionalDependencies) {
            children = formatListDependenciesRaw(packageJsonFileParsed.optionalDependencies, dependencyNode, DEPENDENCY_CATEGORIES.OPTIONAL);
            dependencyNode.children.optional = children;
        }
        if (packageJsonFileParsed.devDependencies) {
            children = formatListDependenciesRaw(packageJsonFileParsed.devDependencies, dependencyNode, DEPENDENCY_CATEGORIES.DEV);
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
    function formatListDependenciesRaw (listDependenciesRaw, dependencyNode, dependencyCategory) {
        const listDependencyNames = Object.keys(listDependenciesRaw);
        const containerDependencies = [];
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
    async function listInstalledDependenciesAtPath (nodeModulesPath) {
        try {
            await fsAccessAsync(nodeModulesPath);
            const fileNames = await fsReaddirAsync(nodeModulesPath);
            return filterFolders(nodeModulesPath, fileNames);
        } catch (e) {}
    }

    /**
     * Filter a list of file names by keeping just folders.
     * @function
     * @param {String} path - a file system path where to operate.
     * @param {Array} listFileNames - a list of file names.
     * @return {Array} list of folders.
     */
    async function filterFolders (path, listFileNames) {
        const folders = [];
        await Promise.all(listFileNames.map(async (fileName) => {
            const stats = await fsStatAsync(PATH.join(path, fileName));
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
    function findDependency (dependencies, dependencyName, _category) {
        let dependencyFound = null;
        if (_category) {
            const dependencyList = dependencies[_category];
            const exists = dependencyList.some((dependency) => {
                dependencyFound = dependency;
                return dependency.name === dependencyName;
            });
            return exists ? dependencyFound : null;
        }

        const categoriesDependencies = Object.keys(dependencies);
        categoriesDependencies.some((category) => {
            dependencyFound = findDependency(dependencies, dependencyName, category);
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
    async function examineDependencyNodeChildren (dependencyNode) {
        var children = dependencyNode.children,
            childrenCategoryKeys = Object.keys(children);

        return Promise.all(childrenCategoryKeys.map((childCategoryKey) => {
            const childrenCategory = children[childCategoryKey];
            return Promise.all(childrenCategory.map((childNode) => {
                if (!childNode.missing) {
                    return examineDependencyNode(childNode);
                }
            }));
        }));
    }

    function distributeProblemsToRootDependencyNode () {
        var problems = dependencyTree.problems;

        if (Array.isArray(problems)) {
            problems.forEach((problem) => {
                const rootDependencyNode = findDependency(dependencyTree.children, problem.rootParent);
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
