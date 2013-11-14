/* global global */
var Q = require("q"),
    QFS = require("q-io/fs"),
    PATH = require('path');

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
