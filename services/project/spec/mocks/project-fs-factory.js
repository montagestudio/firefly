/* jshint camelcase: false */
/*global module*/

var DEPENDENCY_CATEGORIES = require("../../package-manager/dependency-node").DEPENDENCY_CATEGORIES;

/*
 * Transforms a "Project FS" object into a object usable for Qfs-mock.
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
 *  Moreover, you can specify any type of dependencies, or even simulate errors,
 *  such as a missing or extraneous dependency.
 *
 *  Can find a complete example here: project-fs-sample.js
 *
 */

module.exports = function ProjectFSMocksFactory (project) {

    function build () {
        return _parseDependencyNode(project);

    }

    function _parseDependencyNode (dependencyNode) {
        var current = {},
            file = !dependencyNode.jsonFileMissing ? _readJsonFile(dependencyNode) : null;

        if (file) {
            current['package.json'] = file;
            var nodeModules = current.node_modules = {},
                dependencyCategories = Object.keys(DEPENDENCY_CATEGORIES);

            dependencyCategories.forEach(function (dependencyCategoryKey) {
                var dependencyCategory = DEPENDENCY_CATEGORIES[dependencyCategoryKey];
                _parseModuleDependenciesCategory(dependencyNode[dependencyCategory], nodeModules);
            });
        }

        return current;
    }

    function _parseModuleDependenciesCategory (dependencies, nodeModules) {
        if (Array.isArray(dependencies) && dependencies.length > 0) {
            dependencies.forEach(function (dependency) {
                if (!dependency.missing && typeof dependency.name === 'string'){
                    nodeModules[dependency.name] = _parseDependencyNode(dependency);
                }
            });
        }
    }

    function _readJsonFile (module) {
        if (module && typeof module === 'object' &&  typeof module.name === 'string' &&
            typeof module.version === 'string' && (/^([0-9]+\.){2}[0-9]+$/).test(module.version)) {

            var jsonFile = {
                    name: module.name,
                    version: module.version
                },
                dependencyCategories = Object.keys(DEPENDENCY_CATEGORIES);

            dependencyCategories.forEach(function (dependencyCategoryKey) {
                var dependencyCategory = DEPENDENCY_CATEGORIES[dependencyCategoryKey];
                _readDependenciesCategoryFromJsonFile(module[dependencyCategory], jsonFile, dependencyCategory);
            });

            _getBundledDependencies(module, jsonFile);

            return !module.jsonFileError ? JSON.stringify(jsonFile) : JSON.stringify(jsonFile) + "{";
        }

        return null;
    }

    function _readDependenciesCategoryFromJsonFile (dependencies, jsonfile, category) {
        if (Array.isArray(dependencies) && dependencies.length > 0) {
            var container = jsonfile[category] = {};

            dependencies.forEach(function (dependency) {
                if (!dependency.extraneous) {
                    var isString = typeof dependency.version === 'string';
                    container[dependency.name] = isString ? dependency.version : '';

                    if (isString && dependency.invalid) {
                        dependency.version = parseInt(dependency.version[0], 10) + 1 + dependency.version.substr(1);
                    }
                }
            });
        }
    }

    function _getBundledDependencies (module, file) {
        var bundledDependencies = module.bundledDependencies;

        if (Array.isArray(bundledDependencies) && bundledDependencies.length > 0) {
            var bundledDependencyContainer = file.bundledDependencies = [];

            bundledDependencies.forEach(function (bundledDependency) {
                bundledDependencyContainer.push(bundledDependency);
            });
        }
    }

    return build();
};
