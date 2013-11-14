/* global global,opener:true */
var Q = require("q"),
    QFS = require("q-io/fs"),
    PATH = require('path'),
    minimatch = require('minimatch'),
    opener = require("opener");

exports.getExtensions = function(extensionFolder) {
    extensionFolder = extensionFolder || PATH.join(global.clientPath, "extensions");

    console.log("getExtensions from " + extensionFolder);
    return QFS.listTree(extensionFolder, function (filePath) {
        return PATH.extname(filePath).toLowerCase() === ".filament-extension" ? true : (filePath ===  extensionFolder ? false : null); // if false return null so directories aren't traversed
    }).then(function (filePaths) {
        return Q.all(filePaths.map(function (filePath) {
            return QFS.stat(filePath).then(function (stat) {
                return {url: "fs://localhost" + filePath, stat: stat};
            });
        }));
    });
};

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

/**
 * Lists all the files in the given path except node_modules and dotfiles.
 * @param  {string} path An absolute path to a directory.
 * @return {Promise.<Array.<string>>} A promise for an array of paths.
 */
exports.listTree = function (path, extraExclude) {
    var exclude = ["node_modules", ".*"];
    if (extraExclude) {
        if (!Array.isArray(extraExclude)) {
            extraExclude = [extraExclude];
        }
        exclude.push.apply(exclude, extraExclude);
    }
    return QFS.listTree(path, guard(exclude)).then(pathsToUrlStatArray);
};

exports.list = function (path) {
    return QFS.list(path).then(function (filenames) {

        var paths = filenames.filter(function (name) {
            return !(/^\./).test(name);
        }).map(function (filename) {
            return PATH.join(path, filename);
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
exports.listPackage = function (path) {
    var exclude = ["node_modules", ".*"];

    return QFS.read(PATH.join(path, "package.json")).then(function (contents) {
        var pkg = JSON.parse(contents);
        return guard(exclude.concat(pkg.exclude || []));
    }, function (err) {
        return guard(exclude);
    }).then(function (guard) {
        return QFS.listTree(path, guard).then(pathsToUrlStatArray);
    });
};

exports.open = function (thing) {
    var done = Q.defer();
    opener(thing, done.makeNodeResolver());
    return done.promise;
};

/**
 * Converts an array of (absolute) paths to an array of objects with `url`
 * and `stat` properties.
 * @param  {Array.<string>} paths Absolute paths.
 * @return {Promise.<Array.<{url, stat}>>}
 */
function pathsToUrlStatArray(paths) {
    return Q.all(paths.map(function (path) {
        return QFS.stat(path).then(function (stat) {
            // Directories in URLs must have a trailing slash
            if (stat.isDirectory()) {
                path += "/";
            }
            return {url: "fs://localhost" + path, stat: stat};
        });
    }));
}
