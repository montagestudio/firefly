#!/usr/bin/env node
/*global console */

var Q = require("q");
var optimist = require("optimist");
var uglify = require("mop/lib/minify-javascript");
var FS = require("q-io/fs");
var argv = optimist(process.argv).argv;

var targetRoot = argv.t;

return FS.removeTree(FS.join(targetRoot, "filament"))
.catch(function () {})
.then(function () {
    return FS.listTree(".", function (source, stat) {
        source = FS.normal(source);
        var sourceBase = FS.base(source);
        if (/^\./.test(sourceBase)) {
            return null;
        }
        return stat.isFile();
    }).invoke("reduce", function (ready, source) {
        var target = FS.join(targetRoot, "filament", source);
        var targetParent = FS.directory(target);
        return ready.then(function () {
            return FS.makeTree(targetParent)
            .then(function () {
                if (/\.js$/.test(source)) {
                    return FS.read(source, {charset: "utf-8"})
                    .then(uglify)
                    .then(function (content) {
                        console.log("uglified", target);
                        return FS.write(target, content, {charset: "utf-8"});
                    }, function (error) {
                        console.log("copied non parsable", target);
                        return FS.copy(source, target);
                    });
                } else {
                    console.log("copied", target);
                    return FS.copy(source, target);
                }
            });
        });
    }, Q());
})
.done();

