const log = require("logging").from(__filename);
const Q = require("q");
const exec = require("./exec");
const cp = require("child_process");
const Connection = require("q-connection");
const HttpApps = require("q-io/http-apps/fs");
const StatusApps = require("q-io/http-apps/status");
const path = require("path");

function init(fs, workspacePath) {
    exports.mop = new Mop(fs, workspacePath);
}

async function serveArchivedBuild(request) {
    const archiveLocation = await exports.mop.getBuildArchiveLocation();
    const isFile = await exports.mop._fs.isFile(archiveLocation);
    if (isFile) {
        const response = await HttpApps.file(request, archiveLocation, null, exports.mop._fs);
        const filename = path.basename(archiveLocation);
        response.headers['Content-Disposition'] = 'attachment; filename="' + filename + '"';
        return response;
    } else {
        return StatusApps.notFound(request);
    }
}

class Mop {
    constructor(fs, workspacePath) {
        this._fs = fs;
        this._workspacePath = workspacePath;
        this._buildsLocation = fs.join(workspacePath, "..", "builds");
    }

    async optimize(applicationPath, options) {
        const n = cp.fork(__dirname + "/mop-runner.js");
        const connection = Connection(n);
        if (!options) {
            options = {};
        }
        options.buildLocation = this._buildsLocation;
        log("optimize");
        try {
            return await connection.invoke("optimize", applicationPath, options);
        } finally {
            n.disconnect();
        }
    }

    async archive() {
        try {
            const [ buildLocation, archiveLocation ] = await Q.all([this.getBuildLocation(), this.getBuildArchiveLocation()]);
            const exists = await this._fs.exists(archiveLocation);
            if (exists) {
                await this._fs.remove(archiveLocation);
            }
            const buildLocationParent = path.dirname(buildLocation);
            const buildName = path.basename(buildLocation);
            await exec("zip", ["-r", archiveLocation, buildName], buildLocationParent, false);
            return archiveLocation;
        } catch (error) {
            console.error(error);
            throw new Error("Creating build archive failed.");
        }
    }

    async getPackageDescriptor() {
        const packageJsonFilename = this._fs.join(this._workspacePath, "package.json");
        const packageJson = await this._fs.read(packageJsonFilename);
        return JSON.parse(packageJson);
    }

    async getBuildLocation() {
        const packageDescriptor = await this.getPackageDescriptor();
        return this._fs.join(this._buildsLocation, packageDescriptor.name);
    }

    async getBuildArchiveLocation() {
        const packageDescriptor = await this.getPackageDescriptor();
        return this._fs.join(this._buildsLocation, packageDescriptor.name + ".zip");
    }
}

exports.Mop = Mop;
exports.init = init;
exports.serveArchivedBuild = serveArchivedBuild;
