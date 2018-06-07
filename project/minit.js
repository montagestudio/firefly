const log = require("logging").from(__filename);
const PATH = require("path");
const FS = require("q-io/fs");
const exec = require("./exec");

module.exports = class Minit {
    constructor(path) {
        this._path = path;
    }

    async createApp(path, name) {
        log(path + "$ create:digit -n " + name);
        // Minit creates the app in the directory you give it, base on the name you
        // give it, so we just create it in /tmp and move it where it's needed.
        const dest = "_" + new Date().getTime() + Math.floor(Math.random() * 999999),
            destFullPath = PATH.join("/tmp", dest);
        try {
            await exec(this._path, ["create:digit", "-n", name, "-d", dest], "/tmp")
            // As minit might have altered the name we provided, we need to list the
            // destination directory to find out the new name
            const paths = await FS.list(destFullPath);
            if (paths.length !== 1) {
                throw new Error("unexpected minit output");
            }
            const source = PATH.join(destFullPath, paths[0]);
            log("moving", source, "to", path);
            await FS.move(source, path);
        } finally {
            await FS.removeDirectory(destFullPath);
        }
    }

    async createComponent(path, name, destination) {
        const args = ["create:component", "-n", name];
        if (destination) {
            args.push("-d");
            args.push(destination);
        }
        log(path + "$ " + args);
        return exec(this._path, args, path);
    }

    async createModule(path, name, extendsModuleId, extendsName, destination) {
        const args = ["create:module", "-n", name];
        if (extendsModuleId && extendsName) {
            args.push("--extends-module-id", extendsModuleId);
            args.push("--extends-name", extendsName);
        }
        if (destination) {
            args.push("-d");
            args.push(destination);
        }
        log(path + "$ " + args);
        return exec(this._path, args, path);
    }
}
