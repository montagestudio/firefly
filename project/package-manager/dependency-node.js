function makeDependencyNode() {

    const dependencyNode = {};
    dependencyNode.name = '';
    dependencyNode.version = '';
    dependencyNode.versionInstalled = null;
    dependencyNode.type = null;

    dependencyNode.fileJsonRaw = null;
    dependencyNode.path = null;
    dependencyNode.bundled = [];

    dependencyNode.parent = null;
    dependencyNode.children = {
        regular: [],
        optional: [],
        dev: []
    };

    dependencyNode.missing = true;
    dependencyNode.extraneous = false;
    dependencyNode.jsonFileError = false;
    dependencyNode.jsonFileMissing = false;

    Object.defineProperties(dependencyNode, {
        parent: { enumerable: false},
        path: { enumerable: false}
    });

    return dependencyNode;
}

makeDependencyNode.DEPENDENCY_CATEGORIES = {
    REGULAR: 'dependencies',
    OPTIONAL: 'optionalDependencies',
    DEV: 'devDependencies',
    BUNDLED : 'bundledDependencies'
};

module.exports = makeDependencyNode;
