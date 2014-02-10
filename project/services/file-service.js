var log = require("logging").from(__filename);
var Q = require("q");
var minimatch = require("minimatch");
var PATH = require('path');
var URL = require("url");
var watchr = require("watchr");
var detectMimeType = require("../detect-mime-type");

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

module.exports = exports = FileService;
var makeConvertProjectUrlToPath = exports.makeConvertProjectUrlToPath = function (pathname) {
    return function (url) {
        return URL.parse(url).pathname;
    };
};

var makeConvertPathToProjectUrl = exports.makeConvertPathToProjectUrl = function (pathname, environment) {
    return function (path) {
        var projectHost = environment.getProjectUrlFromAppUrl(pathname);
        return projectHost + path;
    };
};

function FileService(fs, environment, pathname, fsPath) {
    // Returned service
    var service = {};

    var convertProjectUrlToPath = makeConvertProjectUrlToPath(pathname);
    var convertPathToProjectUrl = makeConvertPathToProjectUrl(pathname, environment);

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
     * @param  {string} url The url to the project file.
     * @param  {Array.<string>} extraExclude The list of files to exclude.
     * @return {Promise.<Array.<FileDescriptor>>} A promise for an array of FileDescriptors.
     */
    service.listTree = function (url, extraExclude) {
        var localPath = convertProjectUrlToPath(url);
        var exclude = ["node_modules", ".*"];

        if (extraExclude) {
            if (!Array.isArray(extraExclude)) {
                extraExclude = [extraExclude];
            }
            exclude.push.apply(exclude, extraExclude);
        }
        return fs.listTree(localPath, guard(exclude)).then(pathsToUrlStatArray);
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
     * Lists all the asset files in the given path except node_modules and dotfiles.
     * @param  {string} url - Location where to operate.
     * @param  {(string|Array)} extraExclude - Some additional locations to exclude.
     * @return {Promise.<Array.<string>>} A promise for an array of paths.
     */
    service.listAsset = function (url, extraExclude) {
        var exclude = ["node_modules", ".*"],
            localPath = convertProjectUrlToPath(url);

        if (extraExclude) {
            if (!Array.isArray(extraExclude)) {
                extraExclude = [extraExclude];
            }
            exclude.push.apply(exclude, extraExclude);
        }

        var excludeGuard = guard(exclude);

        return fs.listTree(localPath, function (path, stat) {
            return excludeGuard(path, stat) && !stat.isDirectory();
        }).then(function (paths) {
                return Q.all(paths.map(function (path) {
                    return fs.stat(path).then(function (stat) {
                        return detectMimeType(fs, path, fsPath).then(function (mimeType) {
                            return {url: convertPathToProjectUrl(path), stat: stat, mimeType: mimeType};
                        });
                    });
                }));
            });
    };

    service.detectMimeTypeAtUrl = function (url) {
        var path = convertProjectUrlToPath(url);
        return detectMimeType(fs, path, fsPath);
    };


    service.writeFile = function (url, base64) {
        var buffer = new Buffer(base64, "base64");
        var path = convertProjectUrlToPath(url);
        path = decodeURIComponent(path);
        return fs.write(path, buffer);
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

    service.watch = function (url, ignoreSubPaths, handlers) {
        var ignorePaths = ignoreSubPaths.map(function (ignorePath) {
            return PATH.resolve(fsPath, ignorePath) + PATH.sep;
        });

        //TODO make sure we return whatever watcher handle we need to stop watching, probably
        return Q.invoke(watchr, "watch", {
            path: fsPath,
            ignorePaths: ignorePaths,
            ignoreCommonPatterns: true,
            listeners: {
                change: function(changeType, filePath, fileCurrentStat, filePreviousStat) {

                    //The client expects directories to have a trailing slash
                    var fileStat = fileCurrentStat || filePreviousStat;
                    if (fileStat.isDirectory() && !/\/$/.test(filePath)) {
                        filePath += "/";
                    }

                    filePath = filePath.replace(fsPath, "");
                    var url = convertPathToProjectUrl(filePath);

                    // FIXME Don't pass in the stat objects, because they could
                    // be used for nefarious purposes
                    handlers.handleChange.fcall(changeType, url, fileCurrentStat)
                    .catch(function (error) {
                        log("handleChange", "*" + error.stack + "*");
                    });
                },
                error: function(err) {
                    handlers.handleChange.fcall(err)
                    .catch(function (error) {
                        log("handleError", "*" + error.stack + "*");
                    });
                }
            }
        });
    };

    return service;
}
