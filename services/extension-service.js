/* global global */
var Q = require("q");
var QFS = require("q-io/fs");
var PATH = require('path');

var extensionsRoot = PATH.join(global.clientPath, "extensions");

module.exports = ExtensionService;
function ExtensionService(fs, environment) {
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
    var convertPathToExtensionUrl = function (path) {
        var projectHost = environment.getAppUrl() + "/app/extensions",
            url = null;

        if (new RegExp(extensionsRoot).test(path)) {
            url = projectHost + path.replace(extensionsRoot, "");
        }

        return url;
    };

    var convertExtensionUrlToPath = function (url) {
        var projectHost = environment.getAppUrl() + "/app/extensions",
            extensionRoot = PATH.join(global.clientPath, "extensions"),
            path = null;

        if (new RegExp(projectHost).test(url)) {
            path = extensionRoot + url.replace(projectHost, "");
        }

        return path;
    };

    service.getExtensions = function(extensionFolder) {
        extensionFolder = extensionFolder || PATH.join(global.clientPath, "extensions");

        return QFS.listTree(extensionFolder, function (filePath) {
            // if false return null so directories aren't traversed
            return PATH.extname(filePath).toLowerCase() === ".filament-extension" ? true : (filePath ===  extensionFolder ? false : null);
        }).then(function (filePaths) {
                return Q.all(filePaths.map(function (filePath) {
                    return QFS.stat(filePath).then(function (stat) {
                        return {url: convertPathToExtensionUrl(filePath), stat: stat};
                    });
                }));
            });
    };

    service.listLibraryItemUrls = function (extensionUrl, packageName) {
        var libraryItemsPath = PATH.join(convertExtensionUrlToPath(extensionUrl), "library-items", packageName);

        return QFS.listTree(libraryItemsPath, function (filePath) {
            return PATH.extname(filePath).toLowerCase() === ".library-item" ? true : (filePath ===  libraryItemsPath ? false : null);
        }).then(function (filePaths) {
            return Q.all(filePaths.map(function (filePath) {
                return QFS.stat(filePath).then(function (stat) {
                    return convertPathToExtensionUrl(filePath) + (stat.isDirectory() ? "/" : "");
                });
            }));
        });
    };

    service.listModuleIconUrls = function (extensionUrl, packageName) {
        var iconsPath = PATH.join(convertExtensionUrlToPath(extensionUrl), "icons", packageName);

        return QFS.listTree(iconsPath, function (filePath) {
            return PATH.extname(filePath).toLowerCase() === ".png";
        }).then(function (filePaths) {
            return filePaths.map(function (filePath) {
                return convertPathToExtensionUrl(filePath);
            });
        });
    };

    return service;
}
