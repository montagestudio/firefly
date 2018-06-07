const PATH = require('path');
const Url = require("url");

const parseIndexHtml = (body) => {
    const filePaths = [];
    const regex = /^<a href="(.*?)">/gm;
    let matches = /<title>Index of (.*?)<\/title>/.exec(body);
    if (matches) {
        const baseUrl = matches[1];
        while ((matches = regex.exec(body))) {
            filePaths.push(PATH.join(baseUrl, matches[1]));
        }
    }
    return filePaths;
};

module.exports = ExtensionService;
function ExtensionService(_, fs, __, ___, request) {
    const appHost = process.env.FIREFLY_APP_URL || "https://local.montage.studio:2440";
    const appExtensionsUrl = Url.resolve(appHost, "app/extensions/");
    const staticExtensionsUrl = "http://firefly_static/app/extensions/";
    const requestAsync = (url) => new Promise((resolve, reject) => {
        request(url, (err, response, body) => {
            if (err) {
                reject(err);
            } else {
                resolve(body);
            }
        })
    });

    /**
     * Convert a path on the system that specifies a path to an available extension
     * to a safe URI for consumption by a potentially malicious client.
     *
     * Extensions should be able to be loaded and run, with constying degrees of trust
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
    const convertPathToExtensionUrl = (path, base) => Url.format(Url.resolve(base || appHost, path));

    const convertAppExtensionUrlToStaticExtensionUrl = (extensionUrl) => extensionUrl.replace(appExtensionsUrl, staticExtensionsUrl);

    return {
        async getExtensions(extensionFolder = staticExtensionsUrl) {
            const response = await requestAsync(extensionFolder);
            const filePaths = parseIndexHtml(response);
            return filePaths.map((filePath) => ({ url: convertPathToExtensionUrl(filePath) }));
        },

        async listLibraryItemUrls(extensionUrl, packageName) {
            const staticUrl = convertAppExtensionUrlToStaticExtensionUrl(extensionUrl);
            const path = Url.format(Url.resolve(staticUrl, PATH.join("library-items", packageName)));
            const response = await requestAsync(path);
            const filePaths = parseIndexHtml(response);
            return filePaths.map((filePath) => convertPathToExtensionUrl(filePath));
        },

        async loadLibraryItemJson(libraryItemJsonUrl) {
            const staticUrl = convertAppExtensionUrlToStaticExtensionUrl(libraryItemJsonUrl);
            const response = await requestAsync(staticUrl);
            return JSON.parse(response);
        },

        async listModuleIconUrls(extensionUrl, packageName) {
            const staticUrl = convertAppExtensionUrlToStaticExtensionUrl(extensionUrl);
            const iconsPath = Url.format(Url.resolve(staticUrl, PATH.join("icons", packageName)));
            const response = await requestAsync(iconsPath);
            const filePaths = parseIndexHtml(response);
            return filePaths.map((filePath) => convertPathToExtensionUrl(filePath));
        }
    }
}
