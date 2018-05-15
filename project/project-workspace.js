const log = require("logging").from(__filename);
const PATH = require("path");
const Minit = require("./minit");
const RepositoryService = require("./services/repository-service").service;
const fs = require("q-io/fs");
const PackageManagerService = require("./services/package-manager-service");

const INITIAL_COMMIT_MSG = "Initial commit";
const UPDATE_DEPENDENCIES_MSG = "Update dependencies";
const DEFAULT_GIT_EMAIL = "noreply";

/**
 * This object represents a project workspace and provides the operations needed
 * to intialize it and manage it.
 * A project workspace is a directory will all the files of a specific project.
 * The workspace can be initialized from a remote git repository or it can be
 * created from scratch and pushed to a remote git repository. Either way, the
 * workspace is meant to be synchronized with a remote git repository.
 *
 * The operations provided are:
 * - Initialize the workspace
 * - Save a file to the workspace
 * - Create a montage component and add it to the workspace
 * - Create a montage module and add it to the workspace
 * - Flush the workspace (sends all local changes to the remote git repository)
 */
class ProjectWorkspace {
    constructor(config, workspacePath, owner, repo, minitPath, githubApi) {
        this._fs = fs;
        this._config = config;
        this._workspacePath = workspacePath;
        this._owner = owner;
        this._repo = repo;
        this._githubApi = githubApi;
        this._minitPath = minitPath;
    }

    get _repoService() {
        if (!this.__repoService) {
            this.__repoService = RepositoryService(this._config.username, this._owner, this._config.githubAccessToken, this._repo, this._fs, this._workspacePath, true, this._githubApi);
        }
        return this.__repoService;
    }

    /**
     * Workspace setup operations
     */
    async existsWorkspace() {
        return this._fs.exists(this._fs.join(this._workspacePath, ".git"));
    }

    async existsNodeModules() {
        return this._fs.exists(this._fs.join(this._workspacePath, "node_modules"));
    }

    async initializeWorkspace() {
        const exists = await this.existsWorkspace();
        if (!exists) {
            const isEmpty = await this._repoService.isProjectEmpty()
            if (isEmpty) {
                return this.initializeWithEmptyProject();
            } else {
                return this.initializeWithRepository();
            }
        }
    }

    /**
     * Initializes the workspace by creating an empty app and pushing it to the
     * remote repository.
     */
    async initializeWithEmptyProject() {
        const minit = new Minit(this._minitPath);
        await minit.createApp(this._workspacePath, this._repo);
        await this._repoService.setupProject();
        await this._setupWorkspaceRepository();
        await this._repoService.commitFiles(null, INITIAL_COMMIT_MSG);
        await this._repoService._flush();
        const branch = await this._repoService.defaultBranchName()
        return this._repoService.checkoutShadowBranch(branch);
    }

    /**
     * Initializes the workspace by cloning the remote repository.
     */
    async initializeWithRepository() {
        await this._repoService.cloneProject()
        const branch = await this._repoService.defaultBranchName()
        await this._repoService.checkoutShadowBranch(branch);
        await this._setupWorkspaceRepository();
        await this._repoService.commitFiles(null, UPDATE_DEPENDENCIES_MSG);
        await this._repoService._flush();
    }

    async initializeWithTemplate(templateDirectory) {
        const exists = await this.existsWorkspace();
        if (!exists) {
            await this._repoService.cloneTemplate(templateDirectory)
            await this._repoService.checkoutShadowBranch("master");
            await this._setupWorkspaceRepository();
        }
    }

    /**
     * File related operations
     */

    async saveFile(filename, contents) {
        if (!filename) {
            throw new TypeError("Filename missing.");
        }
        if (!contents) {
            throw new TypeError("Contents missing.");
        }

        // Since filename is passed in the request's body, it's going to have the
        // project subdomain in the path. We need to remove this to get the fs file name
        if (filename.indexOf(this._config.subdomain) === 0) {
            filename = filename.substring(this._config.subdomain.length);
        }
        log("save file: " + this._workspacePath + "/" + filename);
        const fs = await this._fs.reroot(this._workspacePath);
        try {
            await fs.write(filename, contents);
        } catch (error) {
            console.error(error);
            throw new Error("Save file failed.");
        }
    }

    /**
     * Montage related operations
     */

    async createComponent(name, destination) {
        const minit = new Minit(this._minitPath);
        if (!name) {
            throw new TypeError("Name missing.");
        }
        log("create component in: " , this._workspacePath + (destination)? "/" + destination : "");
        await minit.createComponent(this._workspacePath, name, destination);
        return this.flushWorkspace("Add component " + name);
    }

    async createModule(name, extendsModuleId, extendsName, destination) {
        const minit = new Minit(this._minitPath);
        if (!name) {
            throw new TypeError("Name missing.");
        }
        log("create module in: " , this._workspacePath);
        await minit.createModule(this._workspacePath, name, extendsModuleId, extendsName, destination);
        return this.flushWorkspace("Add module " + name);
    }

    /**
     * Git related operations
     */

    /**
     * Creates a single commit with all changes in the workspace and pushes it to
     * the default remote.
     */
    async flushWorkspace(message) {
        await this._repoService.commitFiles(null, message);
        return this._repoService._flush();
    }

    /**
     * Creates the git config with the user name and email to be used for commits.
     * Installs the needed node modules.
     */
    async _setupWorkspaceRepository() {
        const githubUser = this._config.githubUser;
        const name = githubUser.name || githubUser.login;
        const email = githubUser.email || DEFAULT_GIT_EMAIL;
        await this._repoService.setUserInfo(name, email);
        return this._npmInstall();
    }

    /**
     * NPM related operations
     */
    async _npmInstall() {
        // Let the PackageManager installs the project's dependencies.
        const pathname =  PATH.sep + PATH.join(this._owner, this._repo),
            fsPath = this._workspacePath;

        const fs = await this._fs.reroot(this._workspacePath);
        const service = PackageManagerService(null, fs, null, pathname, fsPath);
        return service.installProjectPackages();
    }
}

module.exports = ProjectWorkspace;
