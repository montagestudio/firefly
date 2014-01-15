/* jshint camelcase: false */

var DEPENDENCY_CATEGORIES = require("../package-manager/dependency-node").DEPENDENCY_CATEGORIES;

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
