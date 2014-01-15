var DependencyNode = function DependencyNode () {

    this.name = '';
    this.version = '';
    this.versionInstalled = null;
    this.type = null;

    this.fileJsonRaw = null;
    this.path = null;
    this.bundled = [];

    this.parent = null;
    this.children = {
        regular: [],
        optional: [],
        dev: []
    };

    this.missing = true;
    this.extraneous = false;
    this.jsonFileError = false;
    this.jsonFileMissing = false;

    Object.defineProperty(this, 'parent', {
        enumerable: false
    });
};

DependencyNode.DEPENDENCY_CATEGORIES = {
    REGULAR: 'dependencies',
    OPTIONAL: 'optionalDependencies',
    DEV: 'devDependencies',
    BUNDLED : 'bundledDependencies'
};

module.exports = DependencyNode;
