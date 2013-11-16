var Q = require("q");
var minimatch = require("minimatch");
var PATH = require('path');
var URL = require("url");

var guard = function (exclude) {
    exclude = exclude || [];
    var minimatchOpts = {matchBase: true};
    return function (path) {
        // make sure none of the excludes match
        return exclude.every(function (glob) {
            return !minimatch(path, glob, minimatchOpts);
        }) ? true : null; // if false return null so directories aren't traversed
    };
};

module.exports = FileService;
function FileService(fs, environment, pathname) {
    // Returned service
    var service = {};

    var convertProjectUrlToPath = exports.convertProjectUrlToPath = function (url) {
        return URL.parse(url).pathname;
    };

    var convertPathToProjectUrl = exports.convertPathToProjectUrl = function (path) {
        var projectHost = environment.getProjectUrl(pathname);
        return projectHost + path;
    };

    /**
     * Converts an array of (absolute) paths to an array of objects with `url`
     * and `stat` properties.
     * @param  {Array.<string>} paths Absolute paths.
     * @return {Promise.<Array.<{url, stat}>>}
     */
    function pathsToUrlStatArray(paths) {
        return Q.all(paths.map(function (path) {
            return fs.stat(path).then(function (stat) {
                // Directories in URLs must have a trailing slash
                if (stat.isDirectory()) {
                    path += "/";
                }

                return {url: convertPathToProjectUrl(path), stat: stat};
            });
        }));
    }

    service.read = function (url) {
        var localPath = convertProjectUrlToPath(url);
        return fs.read(localPath);
    };

    /**
     * Lists all the files in the given path except node_modules and dotfiles.
     * @param  {string} path An absolute path to a directory.
     * @return {Promise.<Array.<string>>} A promise for an array of paths.
     */
    service.listTree = function (path, extraExclude) {
        var exclude = ["node_modules", ".*"];
        if (extraExclude) {
            if (!Array.isArray(extraExclude)) {
                extraExclude = [extraExclude];
            }
            exclude.push.apply(exclude, extraExclude);
        }
        return fs.listTree(path, guard(exclude)).then(pathsToUrlStatArray);
    };

    service.list = function (url) {
        var localPath = convertProjectUrlToPath(url);

        return fs.list(localPath).then(function (filenames) {
            var paths = filenames.filter(function (name) {
                return !(/^\./).test(name);
            }).map(function (filename) {
                return PATH.join(localPath, filename);
            });

            return pathsToUrlStatArray(paths);
        });
    };

    /**
     * Lists all the files in a package except node_modules, dotfiles and files
     * matching the globs listed in the package.json "exclude" property.
     * @param  {string} path An absolute path to the package directory to list.
     * @return {Promise.<Array.<string>>} A promise for an array of paths.
     */
    service.listPackage = function (url) {
        var exclude = ["node_modules", ".*"];

        var path = convertProjectUrlToPath(url);

        return fs.read(PATH.join(path, "package.json")).then(function (contents) {
            var pkg = JSON.parse(contents);
            return guard(exclude.concat(pkg.exclude || []));
        }, function (err) {
            return guard(exclude);
        }).then(function (guard) {
            return fs.listTree(path, guard).then(pathsToUrlStatArray);
        });
    };

    service.open = function (thing) {
        var done = Q.defer();
        // opener(thing, done.makeNodeResolver());
        done.reject(new Error("TODO Implement me"));
        return done.promise;
    };

    return service;
}
