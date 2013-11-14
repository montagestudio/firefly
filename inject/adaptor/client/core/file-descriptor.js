/* jshint -W016 */
var Montage = require("montage").Montage;
var SortedArray = require("montage/collections/sorted-array");

var FileDescriptor = exports.FileDescriptor = Montage.specialize({

    constructor: {
        value: function FileDescriptor () {
            this.super();
        }
    },

    initWithUrlAndStat: {
        value: function (url, stat) {
            this.fileUrl = url;

            this._stat = stat;

            var isDirectory = this.isDirectory;
            if (isDirectory && url.charAt(url.length -1) !== "/") {
                throw new Error("URLs for directories must have a trailing '/'");
            }

            var parts = url.split("/");
            if (isDirectory) {
                // Directories have a trailing slash, and so the last part is empty
                this.name = parts[parts.length - 2];
                this.children = SortedArray();
            } else {
                this.name =  parts[parts.length - 1];
            }

            return this;
        }
    },

    _stat: {
        value: null
    },

    fileUrl: {
        value: null
    },

    name: {
        value: null
    },

    isDirectory: {
        get: function () {
            return this._checkModeProperty(FileDescriptor.S_IFDIR);
        }
    },

    isReel: {
        get: function () {
            return (this.isDirectory && (/\.reel$/).test(this.name));
        }
    },

    isPackage: {
        get: function () {
            return (!this.isDirectory && this.name === "package.json");
        }
    },

    isImage: {
        get: function () {
            return (!this.isDirectory && (/\.(png|jpe?g)$/).test(this.name));
        }
    },

    // more `is*` functions defined below

    associatedDocument: {
        value: null
    },

    _checkModeProperty: {
        value: function (property) {
            var stat = this._stat,
                mode = stat.node ? stat.node.mode : stat.mode;
            return ((mode & FileDescriptor.S_IFMT) === property);
        }
    },

    equals: {
        value: function (other) {
            return this.fileUrl === other.fileUrl;
        }
    },

    compare: {
        value: function (other) {
            // sort directories first
            if (this.isDirectory && !other.isDirectory) {
                return -1;
            } else if (other.isDirectory && !this.isDirectory) {
                return 1;
            }

            var thisUrl = this.fileUrl.toLowerCase(), otherUrl = other.fileUrl.toLowerCase();
            if (thisUrl === otherUrl) {
                return 0;
            }
            return thisUrl < otherUrl ? -1 : 1;
        }
    }
}, {
    S_IFDIR: {
        value: 16384
    },
    S_IFMT: {
        value: 61440
    }
});

// All of these `is*` functions just check that the FileDescriptor is a file,
// not a directory, and that the extension matches.
Object.map({
    Json: "json",
    Html: "html",
    Css: "css",
    JavaScript: "js"
}, function (extension, type) {
    var regex = new RegExp("\\." + extension + "$");
    Montage.defineProperty(exports.FileDescriptor.prototype, "is" + type, {
        get: function () {
            return (!this.isDirectory && regex.test(this.name));
        }
    });
});
