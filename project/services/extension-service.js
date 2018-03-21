var PATH = require('path');
var request = require("request");
var Url = require("url");

var requestPromise = function (url) {
    return new Promise(function (resolve, reject) {
        request(url, function (error, response, body) {
            if (error) {
                reject(error);
            } else {
                resolve(body);
            }
        });
    });
};

var parseIndexHtml = function (body) {
    var filePaths = [];
    var regex = /^<a href="(.*?)">/gm;
    var matches = /<title>Index of (.*?)<\/title>/.exec(body);
    var baseUrl;
    if (matches) {
        baseUrl = matches[1];
        while (matches = regex.exec(body)) {
            filePaths.push(PATH.join(baseUrl, matches[1]));
        }
    }
    return filePaths;
};

module.exports = ExtensionService;
function ExtensionService(_, fs, environment) {
    var appHost = environment.getAppUrl();
    var appExtensionsUrl = Url.resolve(appHost, "app/extensions/");
    var staticExtensionsUrl = "http://static/app/extensions/";

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
     *
     * If a base is provided it is used as the base URL rather tha using the value
     * returned bu getAppUrl(). This enable using container URLs.
     */
    var convertPathToExtensionUrl = function (path, base) {
        return Url.format(Url.resolve(base || appHost, path));
    };

    var convertAppExtensionUrlToStaticExtensionUrl = function (extensionUrl) {
        return extensionUrl.replace(appExtensionsUrl, staticExtensionsUrl);
    };

    service.getExtensions = function(extensionFolder) {
        extensionFolder = extensionFolder || staticExtensionsUrl;

        return requestPromise(extensionFolder)
            .then(parseIndexHtml)
            .then(function (filePaths) {
                return filePaths.map(function (filePath) {
                    return {url: convertPathToExtensionUrl(filePath)};
                });
            });
    };

    service.listLibraryItemUrls = function (extensionUrl, packageName) {
        var staticUrl = convertAppExtensionUrlToStaticExtensionUrl(extensionUrl);
        var path = Url.format(Url.resolve(staticUrl, PATH.join("library-items", packageName)));

        return requestPromise(path)
            .then(parseIndexHtml)
            .then(function (filePaths) {
                return filePaths.map(function (filePath) {
                    return convertPathToExtensionUrl(filePath);
                });
            });
    };

    service.loadLibraryItemJson = function (libraryItemJsonUrl) {
        var staticUrl = convertAppExtensionUrlToStaticExtensionUrl(libraryItemJsonUrl);
        return requestPromise(staticUrl)
            .then(JSON.parse);
    };

    service.listModuleIconUrls = function (extensionUrl, packageName) {
        var staticUrl = convertAppExtensionUrlToStaticExtensionUrl(extensionUrl);
        var iconsPath = Url.format(Url.resolve(staticUrl, PATH.join("icons", packageName)));

        return requestPromise(iconsPath)
            .then(parseIndexHtml)
            .then(function (filePaths) {
                return filePaths.map(function (filePath) {
                    return convertPathToExtensionUrl(filePath);
                });
            });
    };

    return service;
}
