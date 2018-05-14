// Utility class for all the {user, owner, repo} objects we have.
// Implements the `equals` and `hash` methods needed for uniqueness in Sets
// and Maps/

const url = require("url");

const PROJECT_IMAGE_PORT = 2441;
const SERVICE_NAME_REPLACE_RE = /[^a-zA-Z0-9-]/g;

module.exports = class ProjectInfo {
    constructor(username, owner, repo) {
        this.username = username.toLowerCase();
        this.owner = owner.toLowerCase();
        this.repo = repo.toLowerCase();
    }

    static fromObject(object) {
        if (object instanceof this) {
            return object;
        } else {
            return new ProjectInfo(object.username, object.owner, object.repo);
        }
    }

    static fromPath(path) {
        if (path[0] !== "/") {
            path = "/" + path;
        }
        const parts = path.split("/");
        if (parts.length < 4) {
            throw new TypeError("Cannot build a ProjectInfo object from " + path);
        }
        return new ProjectInfo(parts[1], parts[2], parts[3]);
    }

    setPrivate(isPrivate) {
        this.private = isPrivate;
    }

    equals(other) {
        return this.username === other.username && this.owner === other.owner && this.repo === other.repo;
    }

    hash() {
        return this.username + "/" + this.owner + "/" + this.repo;
    }

    toString() {
        return `[ProjectInfo ${this.username}, ${this.owner}, ${this.repo}]`;
    }

    toPath() {
        return `/${this.username}/${this.owner}/${this.repo}/`;
    }

    toUrl(base, path) {
        if (base && path) {
            return url.resolve(url.resolve(base, this.toPath()), path);
        } else if (!path) {
            return url.resolve(base, this.toPath);
        } else if (!base) {
            return url.resolve(this.toPath(), path);
        } else {
            return this.toPath();
        }
    }

    get serviceName() {
        const username = this.username.replace(SERVICE_NAME_REPLACE_RE, "");
        const owner = this.owner.replace(SERVICE_NAME_REPLACE_RE, "");
        const repo = this.repo.replace(SERVICE_NAME_REPLACE_RE, "");

        return username + "_" + owner + "_" + repo;
    }

    get url() {
        return this.serviceName + ":" + PROJECT_IMAGE_PORT;
    }
}
