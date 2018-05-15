const semver = require("semver"),
    DEPENDENCY_CATEGORIES = require("./dependency-node").DEPENDENCY_CATEGORIES,
    ERROR_TYPES = {
        VERSION_INVALID: 0,
        DEPENDENCY_MISSING: 1,
        DEPENDENCY_EXTRANEOUS: 2,
        PACKAGE_FILE_INVALID: 3
    };

function DetectErrorDependencyTree(dependencyTree) {
    const problems = [];

    function _examineDependencyTree() {
        _examineDependencyNode(dependencyTree);

        return problems;
    }

    function _examineDependencyNode(dependencyNode) {
        const children = dependencyNode.children;

        if (children && typeof children === "object") {
            const childrenCategoriesKey = Object.keys(children);

            childrenCategoriesKey.forEach((childrenCategoryKey) => {
                const childrenCategory = children[childrenCategoryKey];
                _examineChildrenCategory(dependencyNode, childrenCategory, childrenCategoryKey);
            });
        }
    }

    function _examineChildrenCategory(parent, children, dependencyCategory) {
        if (Array.isArray(children)) {
            children.forEach((childNode) => {
                _findEventualErrors(parent, childNode, dependencyCategory);
                if (!childNode.extraneous) {
                    _examineDependencyNode(childNode);
                }
            });
        }
    }

    function _findEventualErrors(parentNode, childNode, dependencyCategory) {
        if (!childNode.jsonFileError && !childNode.jsonFileMissing) { // If no file errors.
            if (childNode.missing && childNode.type === DEPENDENCY_CATEGORIES.REGULAR) { // If the childNode is missing.
                const substituteDependency = _searchSubstituteParentNode(parentNode, childNode.name); // Check if one of its parents have it.
                if (!substituteDependency) { // Parents don't have it.
                    _reportError(childNode, ERROR_TYPES.DEPENDENCY_MISSING, dependencyCategory, parentNode);
                } else { // Parents have it.
                    childNode.versionInstalled = substituteDependency.versionInstalled;
                    if (semver.validRange(childNode.version) && !semver.satisfies(childNode.versionInstalled, childNode.version, true)) {
                        _reportError(childNode, ERROR_TYPES.VERSION_INVALID, dependencyCategory, parentNode);
                    }
                }
            } else if (childNode.extraneous && parentNode.bundled.indexOf(childNode.name) < 0) { // If not within the package.json file.
                _reportError(childNode, ERROR_TYPES.DEPENDENCY_EXTRANEOUS, dependencyCategory, parentNode);
            } else if (!childNode.missing && childNode.type !== DEPENDENCY_CATEGORIES.DEV && semver.validRange(childNode.version) &&
                !semver.satisfies(childNode.versionInstalled, childNode.version, true)) { // Check the version requirement.
                _reportError(childNode, ERROR_TYPES.VERSION_INVALID, dependencyCategory, parentNode);
            }
        } else {
            if (childNode.extraneous) {
                _reportError(childNode, ERROR_TYPES.DEPENDENCY_EXTRANEOUS, dependencyCategory, parentNode);
            } else {
                _reportError(childNode, ERROR_TYPES.PACKAGE_FILE_INVALID, dependencyCategory, parentNode);
            }
        }
    }

    function _searchSubstituteParentNode(dependencyNode, DependencyName) {
        if (dependencyNode && dependencyNode.children) {
            const children = dependencyNode.children,
                childrenCategoriesKey = Object.keys(children);
            let substituteParentNode = null;
            childrenCategoriesKey.some((childrenCategoryKey) => {
                const childrenCategory = children[childrenCategoryKey];
                if (Array.isArray(childrenCategory)) {
                    for (let i = 0, length = childrenCategory.length; i < length; i++) {
                        const child = childrenCategory[i];
                        if (!child.jsonFileError && !child.jsonFileMissing && !child.missing && child.name === DependencyName) {
                            substituteParentNode = child;
                            break;
                        }
                    }
                }
                return !!substituteParentNode;
            });
            if (substituteParentNode) {
                return substituteParentNode;
            }
            return _searchSubstituteParentNode(dependencyNode.parent, DependencyName);
        }
    }

    function _reportError(dependencyNode, errorType, dependencyCategory, parentNode) {
        const rootParentNode = _findRootDependencyNode(dependencyNode);
        // Check if an similar error has already been repported.
        if (!_hasErrorAlreadyBeenReported(dependencyNode.path, errorType)) {
            problems.push({
                name: dependencyNode.name,
                type: dependencyCategory,
                version: dependencyNode.versionInstalled || '',
                path: dependencyNode.path,
                message: _formatMessageError(dependencyNode, errorType, parentNode.name),
                parent: parentNode.name,
                rootParent: rootParentNode.name,
                errorType: errorType
            });
        }
    }

    function _findRootDependencyNode(dependencyNode, previous)  {
        if (dependencyNode && dependencyNode.parent) {
            return _findRootDependencyNode(dependencyNode.parent, dependencyNode);
        } else if (typeof previous === 'undefined') {
            return dependencyNode;
        }
        return previous;
    }

    function _hasErrorAlreadyBeenReported(dependencyNodePath, errorType) {
        return problems.some((problem) =>
            dependencyNodePath === problem.path && errorType === problem.errorType);
    }

    function _formatMessageError (dependencyNode, errorType, parentName) {
        let message = null;
        let end;
        switch (errorType) {
            case ERROR_TYPES.VERSION_INVALID:
                message = dependencyNode.name + ' version is invalid';
                break;
            case ERROR_TYPES.DEPENDENCY_MISSING:
                message = dependencyNode.name + ' is missing';
                break;
            case ERROR_TYPES.DEPENDENCY_EXTRANEOUS:
                message = dependencyNode.name + ' is extraneous';
                break;
            case ERROR_TYPES.PACKAGE_FILE_INVALID:
                end = dependencyNode.jsonFileError ? ' shows a few errors' : ' is missing';
                message = 'Package.json file of ' + dependencyNode.name + end;
                break;
        }
        return message + ' [dependency parent: ' + parentName + ']';
    }
    return _examineDependencyTree();
}

DetectErrorDependencyTree.ERROR_TYPES = ERROR_TYPES;

module.exports = DetectErrorDependencyTree;
