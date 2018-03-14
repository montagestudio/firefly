// from https://github.com/joyent/node/blob/master/lib/path.js

// resolves . and .. elements in a path array with directory names there
// must be no slashes, empty elements, or device names (c:\) in the array
// (so also no leading and trailing slashes - it does not distinguish
// relative and absolute paths)
function normalizeArray(parts, allowAboveRoot) {
    // if the path tries to go above the root, `up` ends up > 0
    var up = 0;
    for (var i = parts.length - 1; i >= 0; i--) {
        var last = parts[i];
        if (last === '.') {
            parts.splice(i, 1);
        } else if (last === '..') {
            parts.splice(i, 1);
            up++;
        } else if (up) {
            parts.splice(i, 1);
            up--;
        }
    }

    // if the path is allowed to go above the root, restore leading ..s
    if (allowAboveRoot) {
        for (; up--; up) {
            parts.unshift('..');
        }
    }

    return parts;
}

// posix version
exports.join = function() {
    var paths = Array.prototype.slice.call(arguments, 0);
    return exports.normalize(paths.filter(function(p, index) {
        if (typeof p !== 'string') {
            throw new TypeError('Arguments to path.join must be strings');
        }
        return p;
    }).join('/'));
};

// posix version
exports.normalize = function(path) {
    var isAbsolute = exports.isAbsolute(path),
        trailingSlash = path.substr(-1) === '/';

    // Normalize the path
    path = normalizeArray(path.split('/').filter(function(p) {
        return !!p;
    }), !isAbsolute).join('/');

    if (!path && !isAbsolute) {
        path = '.';
    }
    if (path && trailingSlash) {
        path += '/';
    }

    return (isAbsolute ? '/' : '') + path;
};

// posix version
exports.isAbsolute = function(path) {
    return path.charAt(0) === '/';
};
