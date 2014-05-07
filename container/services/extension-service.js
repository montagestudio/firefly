var Q = require("q");
var QFS = require("q-io/fs");
var PATH = require('path');

module.exports = ExtensionService;
function ExtensionService(session, fs, environment, _, __, clientPath) {
    var extensionsRoot = PATH.join(clientPath, "extensions");

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
    var convertPathToExtensionUrl = function (path, base) {
        var projectHost = environment.getAppUrl() + "/app/extensions",
            url = null;

        if (new RegExp(extensionsRoot).test(path)) {
            url = projectHost + path.replace(extensionsRoot, "");
        } else {
            url = base + path;
        }

        return url;
    };

    var convertExtensionUrlToPath = function (url) {
        var projectHost = environment.getAppUrl() + "/app/extensions",
            path = null;

        if (new RegExp(projectHost).test(url)) {
            path = extensionsRoot + url.replace(projectHost, "");
        } else {
            path = url.replace(/https?:\/\/[^\/]+/, "");
        }

        return path;
    };

    service.getExtensions = function(extensionFolder) {
        extensionFolder = extensionFolder || extensionsRoot;
        return QFS.listTree(extensionFolder, function (filePath) {
            // if false return null so directories aren't traversed
            return PATH.extname(filePath).toLowerCase() === ".filament-extension" ? true : (filePath ===  extensionFolder ? false : null);
        }).then(function (filePaths) {
            return filePaths.map(function (filePath) {
                return {url: convertPathToExtensionUrl(filePath)};
            });
        });
    };

    service.listLibraryItemUrls = function (extensionUrl, packageName) {
        var FS = (extensionUrl.indexOf(environment.getAppUrl()) != -1) ? QFS : fs,
            path = convertExtensionUrlToPath(extensionUrl),
            baseURL = (extensionUrl.match(/https?:\/\/[^\/]+/))[0],
            libraryItemsPath = PATH.join(path, "library-items", packageName);

        return FS.listTree(libraryItemsPath, function (filePath) {
            return PATH.extname(filePath).toLowerCase() === ".library-item" ? true : (filePath ===  libraryItemsPath ? false : null);
        }).then(function (filePaths) {
            return Q.all(filePaths.map(function (filePath) {
                return FS.stat(filePath).then(function (stat) {
                    return convertPathToExtensionUrl(filePath, baseURL) + (stat.isDirectory() ? "/" : "");
                });
            }));
        });
    };

    service.listModuleIconUrls = function (extensionUrl, packageName) {
        var FS = (extensionUrl.indexOf(environment.getAppUrl()) != -1) ? QFS : fs,
            path = extensionUrl.replace(/https?:\/\/[^\/]+/, ""),
            baseURL = (extensionUrl.match(/https?:\/\/[^\/]+/))[0],
            iconsPath = PATH.join(path, "icons", packageName);

        return FS.listTree(iconsPath, function (filePath) {
            return PATH.extname(filePath).toLowerCase() === ".png";
        }).then(function (filePaths) {
            return filePaths.map(function (filePath) {
                return convertPathToExtensionUrl(filePath, baseURL);
            });
        });
    };

    return service;
}
