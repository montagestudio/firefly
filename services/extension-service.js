/* global global */
var Q = require("q");
var PATH = require('path');

var extensionsRoot = PATH.join(global.clientPath, "extensions");

module.exports = ExtensionService;
function ExtensionService(fs) {
    // Returned service
    var service = {};

    /**
     * Convert a path on the system that specifies a path to an available extension
     * to a safe URI for consumption by a potentially malicious client.
     *
     * Extensions should be able to be loaded and run, with varying degrees of trust
     * from a number of locations. They should all be reachable by an extension url.
     *
     * Extensions may be discovered from within:
     *  - Filament itself
     *  - Packages loaded by the user in the course of working on a project
     *  - From a marketplace
     *  - From a user's own selection of available extensions
     */
    var convertPathToExtensionUrl = exports.convertPathToExtensionUrl = function (path) {
        var projectHost = "http://localhost:2440/app/extensions",
            url = null;

        if (new RegExp(extensionsRoot).test(path)) {
            url = projectHost + path.replace(extensionsRoot, "");
        }

        return url;
    };

    //TODO add way to convert extensionUrl back to path

    exports.getExtensions = function(extensionFolder) {
        extensionFolder = extensionFolder || PATH.join(global.clientPath, "extensions");

        return fs.listTree(extensionFolder, function (filePath) {
            // if false return null so directories aren't traversed
            return PATH.extname(filePath).toLowerCase() === ".filament-extension" ? true : (filePath ===  extensionFolder ? false : null);
        }).then(function (filePaths) {
                return Q.all(filePaths.map(function (filePath) {
                    return fs.stat(filePath).then(function (stat) {
                        return {url: convertPathToExtensionUrl(filePath), stat: stat};
                    });
                }));
            });
    };

    return service;
}
