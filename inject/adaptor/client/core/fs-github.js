var Q = require("q");
var Boot = require("./fs-boot");
var GithubApi = require("./github-api");

var concat = function (arrays) {
    return Array.prototype.concat.apply([], arrays);
};

module.exports = GithubFs;

function GithubFs(username, repository, accessToken) {
    this.username = username;
    this.repository = repository;
    this._api = new GithubApi(accessToken);
    this._branchTree = null;
}

GithubFs.prototype = Object.create(Boot);

/**
 * read is a shortcut for opening a file and reading the entire contents into
 * memory. It returns a promise for the whole file contents. By default, read
 * provides a string decoded from UTF-8. With the bytewise mode flag, provides a
 * Buffer.
 * The options argument is identical to that of open.
 */
GithubFs.prototype.read = function(path, options) {
    var self = this,
        binary = options && options.indexOf("b") >= 0,
        param = binary ? "json" : "raw";

    return this._getFile(path).then(function(file) {
        return self._api.getBlob(self.username, self.repository, file.sha, param)
        .then(function(blob) {
            if (param === "raw") {
                return blob;
            } else {
                throw new Error("TODO: implement 'b' mode in read()");
            }
        });
    });
};

/**
 * Returns a promise for a list of file names in a directory. The file names are
 * relative to the given path.
 */
GithubFs.prototype.list = function(path) {
    var self = this;

    // Remove leading slash, the filenames from github don't have a leading
    // slash.
    path = self.normal(path).slice(1);

    return this._getBranchTree().then(function(tree) {
        var fileList = [],
            searching = false,
            // Empty path means searching the root, paths don't have slashes in
            // that case.
            isInDirectoryRegExp = new RegExp("^" + (path ? path + "/" : "") + "[^" + self.SEPARATOR + "]+$"),
            filePath,
            pathLength;

        for (var i = 0, ii = tree.length; i < ii; i++) {
            // TODO: implement a binary search, they are ordered alphabetically
            filePath = tree[i].path;
            // +1 when there's a path because we also need to remove the slash
            // that does not exist in path
            pathLength = path.length + (path ? 1 : 0);

            if (filePath.indexOf(path) === 0) {
                searching = true;
                if (isInDirectoryRegExp.test(filePath)) {
                    fileList.push(filePath.slice(pathLength));
                }
            } else if (searching) {
                break;
            }
        }

        return fileList;
    });
};

/**
 * Returns a promise for a list of files in a directory and all the directories
 * it contains. Does not follow symbolic links.
 * The second argument is an optional guard function that determines what files
 * to include and whether to traverse into another directory. It receives the
 * path of the file, relative to the starting path, and also the stats object
 * for that file. The guard must return a value like:
 *   - true indicates that the entry should be included
 *   - false indicates that the file should be excluded, but should still be
 *         traversed if it is a directory.
 *   - null indiciates that a directory should not be traversed.
 */
GithubFs.prototype.listTree = function(basePath, guard) {
    var self = this;
    basePath = String(basePath || '');
    if (!basePath) {
        basePath = "/";
    }
    guard = guard || function () {
        return true;
    };
    var stat = self.stat(basePath);
    return Q.when(stat, function (stat) {
        var paths = [];
        var include;
        try {
            include = guard(basePath, stat);
        } catch (exception) {
            return Q.reject(exception);
        }
        return Q.when(include, function (include) {
            if (include) {
                paths.push([basePath]);
            }
            if (include !== null && stat.isDirectory()) {
                return Q.when(self.list(basePath), function (children) {
                    paths.push.apply(paths, children.map(function (child) {
                        var path = self.join(basePath, child);
                        return self.listTree(path, guard);
                    }));
                    return paths;
                });
            } else {
                return paths;
            }
        });
    }, function noSuchFile(reason) {
        return [];
    }).then(Q.all).then(concat);
};

/**
 * Follows all symoblic links along a path and returns a promise for the
 * metadata about a path as a Stats object. The Stats object implements:
 * size the size of the file in bytes
 *  - isDirectory(): returns whether the path refers to a directory with entries
 * for other paths.
 *  - isFile(): returns whether the path refers to a file physically stored by
 *  the file system.
 *  - isBlockDevice(): returns whether the path refers to a Unix device driver,
 *  in which case there is no actual data in storage but the operating system
 *  may allow you to communicate with the driver as a blocks of memory.
 *  - isCharacterDevice(): returns whether the path refers to a Unix device
 *  driver, in which case there is no actual data in storage but the operating
 *  system may allow you to communicate with the driver as a stream.
 *  - isSymbolicLink(): returns whether the path refers to a symbolic link or
 *  junction. Stats for symbolic links are only discoverable through statLink
 *  since stat follows symbolic links.
 *  - isFIFO(): returns whether the path refers to a Unix named pipe.
 *  isSocket(): returns whether the path refers to a Unix domain socket.
 *  - lastModified(): returns the last time the path was opened for writing as a
 *  Date
 *  - lastAccessed(): returns the last time the path was opened for reading or writing as a Date
 */
GithubFs.prototype.stat = function(path) {
    return this._getFile(path).then(function(file) {
        return new Stats(file);
    });
};

/**
 * Follows symoblic links and returns a promise for whether an entry exists at a
 * given path.
 */
GithubFs.prototype.exists = function(path) {
    return this._getFile(path).then(function(file) {
        return file !== null;
    });
};

GithubFs.prototype._getFile = function(path) {
    var self = this;

    // Remove leading slash, the filenames from github don't have a leading
    // slash.
    path = self.normal(path).slice(1);

    return this._getBranchTree().then(function(tree) {
        for (var i = 0, ii = tree.length; i < ii; i++) {
            // TODO: implement a binary search, they are ordered alphabetically
            if (tree[i].path === path) {
                return tree[i];
            }
        }

        return null;
    });
};

GithubFs.prototype._getBranchTree = function() {
    if (!this._branchTree) {
        this._branchTree = Q.defer();

        var user = this.username,
            repo = this.repository,
            api = this._api,
            self = this;

        api.getRepository(user, repo).then(function(repository) {
            //jshint -W106
            return api.getBranch(user, repo, repository.default_branch)
            //jshint +W106
            .then(function(branch) {
                return api.getTree(user, repo, branch.commit.sha, true)
                .then(function(tree) {
                    self._branchTree.resolve(tree.tree);
                });
            });
        }).fail(this._branchTree.reject).done();
    }

    return this._branchTree.promise;
};

/**
 * File Stat
 */
function Stats(file) {
    this._file = file;
    this.size = file.size;
}

var stats = [
    "isDirectory",
    "isFile",
    "isBlockDevice",
    "isCharacterDevice",
    "isSymbolicLink",
    "isFIFO",
    "isSocket"
];

stats.forEach(function (name) {
    Stats.prototype[name] = function () {
        return false;
    };
});

Stats.prototype.isDirectory = function () {
    return this._file.type === "tree";
};

Stats.prototype.isFile = function () {
    return this._file.type === "blob";
};

Stats.prototype.isSymbolicLink = function () {
    return this._file.type === "120000";
};

Stats.prototype.lastModified = function () {
    return 0; // no info
};

Stats.prototype.lastAccessed = function () {
    return 0; // no info
};
