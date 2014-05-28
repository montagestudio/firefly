var log = require("../../logging").from(__filename);
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

var makeConvertPathToProjectUrl = exports.makeConvertPathToProjectUrl = function (pathname, subdomain, environment) {
    return function (path) {
        var projectHost = environment.getProjectUrl(subdomain);
        return projectHost + path;
    };
};

function FileService(config, fs, environment, pathname, fsPath) {
    // Returned service
    var service = {};

    var convertProjectUrlToPath = makeConvertProjectUrlToPath(pathname);
    var convertPathToProjectUrl = makeConvertPathToProjectUrl(pathname, config.subdomain, environment);

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

                stat = {node: {mode: stat.node.mode}};
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
            glTFBundleExtension = ".glTF",
            localPath = convertProjectUrlToPath(url);

        if (extraExclude) {
            if (!Array.isArray(extraExclude)) {
                extraExclude = [extraExclude];
            }
            exclude.push.apply(exclude, extraExclude);
        }

        var excludeGuard = guard(exclude);

        return fs.listTree(localPath, function (path, stat) {
            var shouldKeep = excludeGuard(path, stat);

            if (shouldKeep) {
                if (stat.isDirectory()) {
                    return PATH.extname(path) === glTFBundleExtension;
                }

                var directoryName = PATH.dirname(path);

                return directoryName && PATH.extname(directoryName) !== glTFBundleExtension;
            }

            return shouldKeep;

        }).then(function (paths) {
                return Q.all(paths.map(function (path) {
                    return fs.stat(path).then(function (stat) {
                        return detectMimeType(fs, path, fsPath).then(function (mimeType) {
                            // Directories in URLs must have a trailing slash
                            if (stat.isDirectory()) {
                                path += "/";
                            }

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
        return fs.write(path, buffer);
    };

    service.makeTree = function (url, mode) {
        var path = convertProjectUrlToPath(url);
        return fs.makeTree(path, mode);
    };

    service.remove = function (url) {
        var path = convertProjectUrlToPath(url);
        return fs.remove(path).catch(function () {
            throw new Error("Can't remove non-existant file: " + url);
        });
    };

    service.removeTree = function (url) {
        var path = convertProjectUrlToPath(url);
        return fs.removeTree(path).fail(function () {
            //TODO the original error was better about specifying where things went wrong
            throw new Error('Can\'t find tree to remove given "' + url + '"');
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

    service.watch = function (url, ignoreSubPaths, handlers) {
        var ignorePaths = ignoreSubPaths.map(function (ignorePath) {
            return PATH.resolve(fsPath, ignorePath) + PATH.sep;
        });

        //TODO make sure we return whatever watcher handle we need to stop watching, probably
        return Q.invoke(watchr, "watch", {
            path: fsPath,
            ignorePaths: ignorePaths,
            ignoreCommonPatterns: false,
            // This is the `ignoreCommonPatterns` regex:
            // https://github.com/bevry/ignorepatterns/blob/master/src/lib/ignorepatterns.coffee
            // which ignores node_modules, which we don't want to do.
            // So let's make our own one:
            ignoreCustomPatterns: /\.git/,
            listeners: {
                change: function(changeType, filePath, fileCurrentStat, filePreviousStat) {
                    // Errors that happen in this callback don't appear
                    // anywhere, so let's capture them
                    try {
                        //The client expects directories to have a trailing slash
                        var fileStat = fileCurrentStat || filePreviousStat;
                        if (fileStat.isDirectory() && !/\/$/.test(filePath)) {
                            filePath += "/";
                        }

                        filePath = filePath.replace(fsPath, "");
                        var url = convertPathToProjectUrl(filePath);

                        // Pass in a reduced stat object, with just the mode. This
                        // is the only used client side, to check if the file is
                        // a directory. See inject/adaptor/client/core/file-descriptor.js
                        fileStat = {mode: fileStat.mode};
                        handlers.handleChange.fcall(changeType, url, fileStat)
                        .catch(function (error) {
                            log("handleChange", "*" + error.stack + "*");
                        });
                    } catch (error) {
                        log("watchr change error", "*" + error.stack + "*");
                    }
                },
                error: function(err) {
                    handlers.handleChange.fcall(err)
                    .catch(function (error) {
                        log("handleError", "*" + error.stack + "*");
                    });
                }
            }
        })
        // Ignore the return value which is ignored on the client side, and
        // contains a lot of properties that really don't need to be serialized
        .thenResolve();
    };

    return service;
}
