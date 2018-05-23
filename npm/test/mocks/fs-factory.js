const mock = require("mock-fs");
const DEPENDENCY_CATEGORIES = require("../../dependency-node").DEPENDENCY_CATEGORIES;

/*
 * Transforms a "Project FS" object into a mock-fs object.
 *
 * A "Project FS" Object, is a set of dependencies with a few properties such as a name,
 * a version or its own dependencies, in order to build a simplified "npm module" file system tree.
 *
 * ex: the following "Project FS" Object:
 *  {
 *      name: a,
 *      version: "1.0.0",
 *      dependencies: [
 *          {
 *              name: b,
 *              version: "1.0.0"
 *          },
 *          {
 *              name: c,
 *              version: "1.2.0"
 *          }
 *      ]
 *  }
 *
 *  will be transformed into this following object:
 *
 *  {
 *      "package.json": "{ name: "a", "version": "1.0.0", dependencies:{ "b": "1.0.0", "c": "1.2.0"} }",
 *      "node_modules": {
 *          "b":{
 *              "package.json": "{ name: "b", "version": "1.0.0", dependencies:{} }",
 *              "node_modules": {}
 *          },
 *          "c":{
 *              "package.json": "{ name: "c", "version": "1.2.0", dependencies:{} }",
 *              "node_modules": {}
 *          }
 *      }
 *  }
 * 
 *  which is passed as the argument to mock-fs.
 *
 *  Moreover, you can specify any type of dependencies, or even simulate errors,
 *  such as a missing or extraneous dependency.
 */

function fsFactory(project) {
    return mock(parseDependencyNode(project));
}
module.exports = fsFactory;

function parseDependencyNode(dependencyNode) {
    const current = {};
    const file = !dependencyNode.jsonFileMissing ? readJsonFile(dependencyNode) : null;
    if (file) {
        current['package.json'] = file;
        const nodeModules = current.node_modules = {};
        const dependencyCategories = Object.keys(DEPENDENCY_CATEGORIES);
        dependencyCategories.forEach((dependencyCategoryKey) => {
            const dependencyCategory = DEPENDENCY_CATEGORIES[dependencyCategoryKey];
            parseModuleDependenciesCategory(dependencyNode[dependencyCategory], nodeModules);
        });
    }
    return current;
}

function parseModuleDependenciesCategory(dependencies, nodeModules) {
    if (Array.isArray(dependencies) && dependencies.length > 0) {
        dependencies.forEach((dependency) => {
            if (!dependency.missing && typeof dependency.name === 'string'){
                nodeModules[dependency.name] = parseDependencyNode(dependency);
            }
        });
    }
}

function readJsonFile(module) {
    if (module && typeof module === 'object' &&  typeof module.name === 'string' &&
        typeof module.version === 'string' && (/^([0-9]+\.){2}[0-9]+$/).test(module.version)) {

        const jsonFile = {
            name: module.name,
            version: module.version
        };
        const dependencyCategories = Object.keys(DEPENDENCY_CATEGORIES);
        dependencyCategories.forEach((dependencyCategoryKey) => {
            const dependencyCategory = DEPENDENCY_CATEGORIES[dependencyCategoryKey];
            readDependenciesCategoryFromJsonFile(module[dependencyCategory], jsonFile, dependencyCategory);
        });
        getBundledDependencies(module, jsonFile);
        return !module.jsonFileError ? JSON.stringify(jsonFile) : JSON.stringify(jsonFile) + "{";
    }
    return null;
}

function readDependenciesCategoryFromJsonFile (dependencies, jsonfile, category) {
    if (Array.isArray(dependencies) && dependencies.length > 0) {
        const container = jsonfile[category] = {};
        dependencies.forEach((dependency) => {
            if (!dependency.extraneous) {
                const isString = typeof dependency.version === 'string';
                container[dependency.name] = isString ? dependency.version : '';
                if (isString && dependency.invalid) {
                    dependency.version = parseInt(dependency.version[0], 10) + 1 + dependency.version.substr(1);
                }
            }
        });
    }
}

function getBundledDependencies (module, file) {
    const bundledDependencies = module.bundledDependencies;
    if (Array.isArray(bundledDependencies) && bundledDependencies.length > 0) {
        const bundledDependencyContainer = file.bundledDependencies = [];
        bundledDependencies.forEach((dependency) => bundledDependencyContainer.push(dependency));
    }
}
