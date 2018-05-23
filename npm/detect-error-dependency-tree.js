const semver = require("semver");
const DEPENDENCY_CATEGORIES = require("./dependency-node").DEPENDENCY_CATEGORIES;

const ERROR_TYPES = require("./error-codes");

function DetectErrorDependencyTree(dependencyTree) {
    const problems = [];

    function examineDependencyTree() {
        examineDependencyNode(dependencyTree);
        return problems;
    }

    function examineDependencyNode (dependencyNode) {
        const children = dependencyNode.children;
        if (children && typeof children === "object") {
            const childrenCategoriesKey = Object.keys(children);
            childrenCategoriesKey.forEach((childrenCategoryKey) => {
                const childrenCategory = children[childrenCategoryKey];
                examineChildrenCategory(dependencyNode, childrenCategory, childrenCategoryKey);
            });
        }
    }

    function examineChildrenCategory (parent, children, dependencyCategory) {
        if (Array.isArray(children)) {
            children.forEach((childNode) => {
                findEventualErrors(parent, childNode, dependencyCategory);
                if (!childNode.extraneous) {
                    examineDependencyNode(childNode);
                }
            });
        }
    }

    function findEventualErrors (parentNode, childNode, dependencyCategory) {
        if (!childNode.jsonFileError && !childNode.jsonFileMissing) { // If no file errors.
            if (childNode.missing && childNode.type === DEPENDENCY_CATEGORIES.REGULAR) { // If the childNode is missing.
                const substituteDependency = searchSubstituteParentNode(parentNode, childNode.name); // Check if one of its parents have it.
                if (!substituteDependency) { // Parents don't have it.
                    reportError(childNode, ERROR_TYPES.DEPENDENCY_MISSING, dependencyCategory, parentNode);
                } else { // Parents have it.
                    childNode.versionInstalled = substituteDependency.versionInstalled;
                    if (semver.validRange(childNode.version) && !semver.satisfies(childNode.versionInstalled, childNode.version, true)) {
                        reportError(childNode, ERROR_TYPES.VERSION_INVALID, dependencyCategory, parentNode);
                    }
                }
            } else if (childNode.extraneous && parentNode.bundled.indexOf(childNode.name) < 0) { // If not within the package.json file.
                reportError(childNode, ERROR_TYPES.DEPENDENCY_EXTRANEOUS, dependencyCategory, parentNode);
            } else if (!childNode.missing && childNode.type !== DEPENDENCY_CATEGORIES.DEV && semver.validRange(childNode.version) &&
                !semver.satisfies(childNode.versionInstalled, childNode.version, true)) { // Check the version requirement.

                reportError(childNode, ERROR_TYPES.VERSION_INVALID, dependencyCategory, parentNode);
            }
        } else {
            if (childNode.extraneous) {
                reportError(childNode, ERROR_TYPES.DEPENDENCY_EXTRANEOUS, dependencyCategory, parentNode);
            } else {
                reportError(childNode, ERROR_TYPES.PACKAGE_FILE_INVALID, dependencyCategory, parentNode);
            }
        }
    }

    function searchSubstituteParentNode (dependencyNode, DependencyName) {
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
                return substituteParentNode;
            });

            if (substituteParentNode) {
                return substituteParentNode;
            }

            return searchSubstituteParentNode(dependencyNode.parent, DependencyName);
        }
    }

    function reportError (dependencyNode, errorType, dependencyCategory, parentNode) {
        const rootParentNode = findRootDependencyNode(dependencyNode);
        // Check if an similar error has already been repported.
        if (!hasErrorAlreadyBeenReported(dependencyNode.path, errorType)) {
            problems.push({
                name: dependencyNode.name,
                type: dependencyCategory,
                version: dependencyNode.versionInstalled || '',
                path: dependencyNode.path,
                message: formatMessageError(dependencyNode, errorType, parentNode.name),
                parent: parentNode.name,
                rootParent: rootParentNode.name,
                errorType: errorType
            });
        }
    }

    function findRootDependencyNode (dependencyNode, previous)  {
        if (dependencyNode && dependencyNode.parent) {
            return findRootDependencyNode(dependencyNode.parent, dependencyNode);
        } else if (typeof previous === 'undefined') {
            return dependencyNode;
        }

        return previous;
    }

    function hasErrorAlreadyBeenReported(dependencyNodePath, errorType) {
        return problems.some((problem) => dependencyNodePath === problem.path && errorType === problem.errorType);
    }

    function formatMessageError(dependencyNode, errorType, parentName) {
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
        return `${message} [dependency parent: ${parentName}]`;
    }

    return examineDependencyTree();
}

module.exports = DetectErrorDependencyTree;
