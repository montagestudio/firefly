/*global process,module*/

var PrepareNpmForExecution = require("./prepare-exec-npm"),
    Arguments = process.argv,
    Q = require("q");

/**
 * Invokes the outdated command.
 * @function
 * @return {Promise.<Object>} A promise with all outdated dependencies.
 */
function _execCommand (npmLoaded) {
    return Q.ninvoke(npmLoaded.commands, "outdated", [], true).then(function (list) {
        return _formatOutDatedListDependencies(npmLoaded, list);
    });
}

/**
 * Formats the information gathered from the NPM command.
 * @function
 * @param {Array} npmLoaded - contains all outdated dependencies.
 * @param {Array} outdatedDependencyList - outdated dependency list.
 * @return {Object} outdated dependency list well formatted.
 */
function _formatOutDatedListDependencies (npmLoaded, outdatedDependencyList) {
    var container = {},
        dir = npmLoaded.prefix;

    outdatedDependencyList.forEach(function (outdatedDependency) {
        var name = outdatedDependency[1],
            current = outdatedDependency[2],
            available = outdatedDependency[3],
            where = outdatedDependency[0];

        if (where === dir && current && current !== available && available !== 'git') {
            container[name] = {
                current: current,
                available: available
            };
        }
    });

    return container;
}

if (require.main === module && Arguments.length === 3) {
    var fsPath = Arguments[2];

    PrepareNpmForExecution(fsPath, null, _execCommand);
}
