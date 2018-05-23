function makeDependencyNode() {
    const dependencyNode = {
        name: '',
        version: '',
        versionInstalled: null,
        type: null,
        fileJsonRaw: null,
        path: null,
        bundled: [],
        parent: null,
        children: {
            regular: [],
            optional: [],
            dev: []
        },
        missing: true,
        extraneous: false,
        jsonFileError: false,
        jsonFileMissing: false
    };
    Object.defineProperties(dependencyNode, {
        parent: { enumerable: false },
        path: { enumerable: false }
    });
    return dependencyNode;
}

module.exports = makeDependencyNode;
module.exports.DEPENDENCY_CATEGORIES = {
    REGULAR: 'dependencies',
    OPTIONAL: 'optionalDependencies',
    DEV: 'devDependencies',
    BUNDLED : 'bundledDependencies'
};
