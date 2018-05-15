const log = require("logging").from(__filename);
const Q = require("q");
const minimatch = require("minimatch");
const PATH = require('path');
const URL = require("url");
const watchr = require("watchr");
const detectMimeType = require("../detect-mime-type");

const guard = (exclude = []) => {
    const minimatchOpts = { matchBase: true };
    return (path) => {
        // make sure none of the excludes match
        return exclude.every((glob) => !minimatch(path, glob, minimatchOpts)) ? true : null; // if false return null so directories aren't traversed
    };
};

module.exports = exports = FileService;
const makeConvertProjectUrlToPath = exports.makeConvertProjectUrlToPath = () => (url) => {
    // Remove the details path (/user/owner/repo/)
    return decodeURI(URL.parse(url).pathname.replace(/^\/.+?\/.+?\/.+?\//, "/"));
};

const makeConvertPathToProjectUrl = exports.makeConvertPathToProjectUrl = function (pathname, subdomain) {
    return (path) => {
        const projectHost = process.env.FIREFLY_PROJECT_URL || "https://project.local.montage.studio:2440";
        const relativePath = path[0] === "/" ? "." + path : path;
        return URL.resolve(URL.resolve(projectHost, subdomain), encodeURI(relativePath));
    };
};

function FileService(config, fs, pathname, fsPath) {
    const convertProjectUrlToPath = makeConvertProjectUrlToPath(pathname);
    const convertPathToProjectUrl = makeConvertPathToProjectUrl(pathname, config.subdomain);

    /**
     * Converts an array of (absolute) paths to an array of objects with `url`
     * and `stat` properties.
     * @param  {Array.<string>} paths Absolute paths.
     * @return {Promise.<Array.<{url, stat}>>}
     */
    async function pathsToUrlStatArray(paths) {
        return Q.all(paths.map((path) => {
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

    return {
        async read(url) {
            const localPath = convertProjectUrlToPath(url);
            return fs.read(localPath);
        },

        async touch(url) {
            const localPath = convertProjectUrlToPath(url);
            const reader = await fs.open(localPath, 'w');
            await reader.close();
        },

        /**
         * Lists all the files in the given path except node_modules and dotfiles.
         * @param  {string} url The url to the project file.
         * @param  {Array.<string>} extraExclude The list of files to exclude.
         * @return {Promise.<Array.<FileDescriptor>>} A promise for an array of FileDescriptors.
         */
        async listTree(url, extraExclude) {
            const localPath = convertProjectUrlToPath(url);
            const exclude = ["node_modules", ".*"];
            if (extraExclude) {
                if (!Array.isArray(extraExclude)) {
                    extraExclude = [extraExclude];
                }
                exclude.push.apply(exclude, extraExclude);
            }
            return fs.listTree(localPath, guard(exclude)).then(pathsToUrlStatArray);
        },

        async list(url) {
            const localPath = convertProjectUrlToPath(url);
            const filenames = await fs.list(localPath);
            const paths = filenames
                .filter((name) => !(/^\./).test(name))
                .map((filename) => PATH.join(localPath, filename));
            return pathsToUrlStatArray(paths);
        },

        /**
         * Lists all the asset files in the given path except node_modules and dotfiles.
         * @param  {string} url - Location where to operate.
         * @param  {(string|Array)} extraExclude - Some additional locations to exclude.
         * @return {Promise.<Array.<string>>} A promise for an array of paths.
         */
        async listAsset(url, extraExclude) {
            const exclude = ["node_modules", ".*"],
                glTFBundleExtension = ".glTF",
                localPath = convertProjectUrlToPath(url);
            if (extraExclude) {
                if (!Array.isArray(extraExclude)) {
                    extraExclude = [extraExclude];
                }
                exclude.push.apply(exclude, extraExclude);
            }
            const excludeGuard = guard(exclude);
            const paths = await fs.listTree(localPath, (path, stat) => {
                const shouldKeep = excludeGuard(path, stat);
                if (shouldKeep) {
                    if (stat.isDirectory()) {
                        return PATH.extname(path) === glTFBundleExtension;
                    }
                    const directoryName = PATH.dirname(path);
                    return directoryName && PATH.extname(directoryName) !== glTFBundleExtension;
                }
                return shouldKeep;
            });
            return Q.all(paths.map(async (path) => {
                const stat = await fs.stat(path);
                const mimeType = await detectMimeType(fs, path, fsPath);
                // Directories in URLs must have a trailing slash
                if (stat.isDirectory()) {
                    path += "/";
                }
                return { url: convertPathToProjectUrl(path), stat: stat, mimeType: mimeType };
            }));
        },

        async detectMimeTypeAtUrl(url) {
            const path = convertProjectUrlToPath(url);
            return detectMimeType(fs, path, fsPath);
        },

        async writeFile(url, base64) {
            const buffer = new Buffer(base64, "base64");
            const path = convertProjectUrlToPath(url);
            return fs.write(path, buffer);
        },

        async makeTree(url, mode) {
            const path = convertProjectUrlToPath(url);
            return fs.makeTree(path, mode);
        },

        async makeTreeWriteFile(url, base64, mode) {
            const directoryName = PATH.dirname(url),
                directoryPath = convertProjectUrlToPath(directoryName),
                filePath = convertProjectUrlToPath(url),
                buffer = new Buffer(base64, "base64");
            await fs.makeTree(directoryPath, mode);
            return fs.write(filePath, buffer);
        },

        async remove(url) {
            const path = convertProjectUrlToPath(url);
            try {
                await fs.remove(path);
            } catch (err) {
                throw new Error(`Can't remove non-existant file: ${url}`);
            }
        },

        async removeTree(url) {
            const path = convertProjectUrlToPath(url);
            try {
                await fs.removeTree(path);
            } catch (error) {
                //TODO the original error was better about specifying where things went wrong
                throw new Error(`Can't find tree to remove given "${url}"`);
            }
        },

        /**
         * Lists all the files in a package except node_modules, dotfiles and files
         * matching the globs listed in the package.json "exclude" property.
         * @param  {string} path An absolute path to the package directory to list.
         * @return {Promise.<Array.<string>>} A promise for an array of paths.
         */
        async listPackage(url) {
            const exclude = ["node_modules", ".*"];
            const path = convertProjectUrlToPath(url);
            let guardFn;
            try {
                const contents = await fs.read(PATH.join(path, "package.json"));
                const pkg = JSON.parse(contents);
                guardFn = guard(exclude.concat(pkg.exclude || []));
            } catch (err) {
                guardFn = guard(exclude);
            }
            return fs.listTree(path, guardFn).then(pathsToUrlStatArray);
        },

        async open() {
            const done = Q.defer();
            // opener(thing, done.makeNodeResolver());
            done.reject(new Error("TODO Implement me"));
            return done.promise;
        },

        async watch(url, ignoreSubPaths, handlers) {
            const ignorePaths = ignoreSubPaths.map(function (ignorePath) {
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
                            let fileStat = fileCurrentStat || filePreviousStat;
                            if (fileStat.isDirectory() && !/\/$/.test(filePath)) {
                                filePath += "/";
                            }

                            filePath = filePath.replace(fsPath, "");
                            const url = convertPathToProjectUrl(filePath);
                            
                            // Pass in a reduced stat object, with just the mode. This
                            // is the only used client side, to check if the file is
                            // a directory. See core/file-descriptor.js
                            fileStat = {mode: fileStat.mode};
                            handlers.handleChange(changeType, url, fileStat)
                            .catch(function (error) {
                                log("handleChange", "*" + error.stack + "*");
                            });
                        } catch (error) {
                            log("watchr change error", "*" + error.stack + "*");
                        }
                    },
                    error: function(err) {
                        handlers.handleChange(err)
                        .catch(function (error) {
                            log("handleError", "*" + error.stack + "*");
                        });
                    }
                }
            })
            // Ignore the return value which is ignored on the client side, and
            // contains a lot of properties that really don't need to be serialized
            .thenResolve();
        }
    }
}
