/*global process,module*/

const PrepareNpmForExecution = require("./prepare-exec-npm"),
    Arguments = process.argv,
    Q = require("q");

/**
 * Invokes the outdated command.
 * @function
 * @return {Promise.<Object>} A promise with all outdated dependencies.
 */
async function _execCommand (npmLoaded) {
    const list = await Q.ninvoke(npmLoaded.commands, "outdated", [], true);
    return _formatOutDatedListDependencies(npmLoaded, list);
}

/**
 * Formats the information gathered from the NPM command.
 * @function
 * @param {Array} npmLoaded - contains all outdated dependencies.
 * @param {Array} outdatedDependencyList - outdated dependency list.
 * @return {Object} outdated dependency list well formatted.
 */
function _formatOutDatedListDependencies (npmLoaded, outdatedDependencyList) {
    const container = {},
        dir = npmLoaded.prefix;
    outdatedDependencyList.forEach((outdatedDependency) => {
        const name = outdatedDependency[1],
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
    const fsPath = Arguments[2];
    PrepareNpmForExecution(fsPath, null, _execCommand);
}
