const log = require('logging').from(__filename);
const request = require('q-io/http').request;
const { promisify } = require('util');
const Q = require('q');
const ProjectInfo = require('./project-info');
const GithubApi = require("github");

const IMAGE_NAME = `montagestudio/firefly-project:${(process.env.PROJECT_VERSION || 'latest')}`;
const IMAGE_PORT = 2441;
const IMAGE_PORT_TCP = IMAGE_PORT + '/tcp';
const PROJECTS_NETWORK = 'firefly_projects';

const containerNameForProjectInfo = (projectInfo) =>
    ['firefly-project', projectInfo.username, projectInfo.owner, projectInfo.repo].join('_');

const containerHasName = (nameOrMatcher, containerInfo) => containerInfo &&
    containerInfo.Names.filter((name) => typeof nameOrMatcher === 'function' ?
        nameOrMatcher(name) :
        name === nameOrMatcher
    ).length > 0;

const isContainerForProjectInfo = (projectInfo, containerInfo) => containerHasName(containerNameForProjectInfo(projectInfo), containerInfo);

module.exports = class ContainerManager {
    constructor(docker, _request) {
        this.docker = docker;
        this.pendingContainers = new Map();
        this.GithubApi = GithubApi;
        // Only used for testing
        this.request = _request || request;
    }

    async has(info) {
        const containerInfos = await this.docker.listContainers();
        return containerInfos.filter(isContainerForProjectInfo.bind(null, info)).length > 0;
    }

    async containersForUser(githubUsername) {
        const { docker } = this;
        const containerInfos = await docker.listContainers();
        const userContainerInfos = containerInfos.filter(containerHasName.bind(null, (name) =>
            name.indexOf(`firefly-project_${githubUsername}`) === 0));
        return userContainerInfos.map((containerInfo) => new docker.Container(docker.modem, containerInfo.Id));
    }

    hostForProjectInfo(projectInfo) {
        return containerNameForProjectInfo(projectInfo) + ':' + IMAGE_PORT;
    }

    async setup(info, githubAccessToken, githubProfile) {
        if (!(info instanceof ProjectInfo)) {
            throw new TypeError('Given info was not an instance of ProjectInfo');
        }
        if (this.pendingContainers.has(info.hash)) {
            return this.pendingContainers.get(info.hash);
        }
        const containerPromise = this.getOrCreate(info, githubAccessToken, githubProfile)
            .then(async (container) => {
                try {
                    await this.start(container);
                    await this.connectToProjectsNetwork(container);
                    await this.waitForProjectServer(containerNameForProjectInfo(info));
                } catch (error) {
                    log('Removing container for', info.toString(), 'because', error.message);
                    await container.remove();
                    throw error;
                }
            })
            .then(() => this.hostForProjectInfo(info));
        this.pendingContainers.set(info.hash, containerPromise);
        return containerPromise;
    }

    async getOrCreate(info, githubAccessToken, githubProfile) {
        let container = this.docker.getContainer(containerNameForProjectInfo(info)),
            doesContainerExist = false;
        try {
            const containerInfo = await container.inspect();
            if (containerInfo.State.Running) {
                doesContainerExist = true;
            } else {
                await container.remove();
            }
        } catch (e) {}
        if (!doesContainerExist) {
            if (!githubAccessToken || !githubProfile) {
                throw new Error('Cannot create project container without github credentials.');
            }
            const isPrivate = await this._getRepoPrivacy(info, githubAccessToken);
            if (isPrivate) {
                info.setPrivate(true);
            }

            log('Creating project container for', info.toString(), '...');

            const options = this.buildOptionsForProjectInfo(info, githubAccessToken, githubProfile);
            container = await this.docker.createContainer(options);
            log('Created container', container.id, 'for', info.toString());
        }
        this.pendingContainers.delete(info.hash);
        return container;
    }

    buildOptionsForProjectInfo(info, githubAccessToken, githubProfile) {
        const projectConfig = {
            username: info.username,
            owner: info.owner,
            repo: info.repo,
            githubAccessToken: githubAccessToken,
            githubUser: githubProfile,
            subdomain: info.toPath()
        };
        return {
            name: containerNameForProjectInfo(info),
            Image: IMAGE_NAME,
            Memory: 1024 * 1024 * 1024,
            MemorySwap: 1024 * 1024 * 1024,
            Cmd: ['-c', JSON.stringify(projectConfig)],
            Env: [
                `NODE_ENV=${(process.env.NODE_ENV || 'development')}`,
                `FIREFLY_APP_URL=${process.env.FIREFLY_APP_URL}`,
                `FIREFLY_PROJECT_URL=${process.env.FIREFLY_PROJECT_URL}`
            ],
            HostConfig: {
                Mounts: [
                    {
                        Type: "volume",
                        Source: "firefly_workspaces",
                        Target: "/root/workspace",
                        ReadOnly: false
                    }
                ]
            },
            PortBindings: {
                [IMAGE_PORT_TCP]: [ { HostIp: '127.0.0.1' }]
            }
        };
    }

    /**
     * Starts a container if it is not already running.
     * @param {Dockerode.Container} container 
     */
    async start(container) {
        try {
            const containerInfo = await container.inspect();
            if (!containerInfo.State.Running) {
                return container.start();
            }
        } catch (err) {
            throw new Error(`Unable to inspect container ${container.id} while trying to start it. Error: ${err.message}`);
        }
        return container;
    }

    /**
     * Connects a container to the projects network so that it can communicate with
     * the project daemon. Does nothing if the container is already on the network.
     * @param {Dockerode.Container} container
     */
    async connectToProjectsNetwork(container) {
        const containerInfo = await container.inspect();
        if (!containerInfo.NetworkSettings || !containerInfo.NetworkSettings.Networks || !containerInfo.NetworkSettings.Networks[PROJECTS_NETWORK]) {
            log('Connecting container', container.id, 'to projects network');
            const projectsNetwork = this.docker.getNetwork(PROJECTS_NETWORK);
            try {
                await projectsNetwork.connect({ Container: container.id });
            } catch (err) {
                throw new Error(`Unable to connect container ${container.id} to the projects network because the network does not exist. Error: ${err.message}`);
            }
        }
        return container;
    }

    /**
     * Waits for a server to be available on the given port. Retries every
     * 100ms until timeout passes.
     * @param  {string} port         The exposed port of the container
     * @param  {number} [timeout]   The number of milliseconds to keep trying for
     * @param  {Error} [error]      An previous error that caused the timeout
     * @return {Promise.<string>}   A promise for the port resolved when the
     * server is available.
     */
    async waitForProjectServer(url, timeout = 5000, error) {
        if (timeout <= 0) {
            throw new Error(`Timeout while waiting for server at ${url} ${error ? ' because ' + error.message : ''}`);
        }
        return this.request({
            host: url,
            port: IMAGE_PORT,
            method: 'OPTIONS',
            path: '/'
        })
        .timeout(100)
        .catch((error) => {
            log('Server at', url, 'not available yet. Trying for', timeout - 100, 'more ms');
            return Q.delay(100).then(() => {
                return this.waitForProjectServer(url, timeout - 100, error);
            });
        });
    }

    async delete(info) {
        const containerInfos = await this.listContainers();
        const containerInfo = containerInfos.filter(isContainerForProjectInfo.bind(null, info))[0];
        const container = this.docker.getContainer(containerInfo.Id);
        await container.stop();
        await container.remove();
    }

    async deleteUserContainers(githubUsername) {
        const containers = await this.containersForUser(githubUsername);
        return Promise.all(containers.map((container) => {
            return container.stop()
                .then(function () {
                    return container.remove();
                });
        }));
    }

    async _getRepoPrivacy(info, githubAccessToken) {
        if (typeof info.private === 'undefined' && githubAccessToken) {
            const githubApi = new this.GithubApi({
                version: '3.0.0',
                headers: {
                    'user-agent': 'MontageStudio.com'
                }
            });
            githubApi.authenticate({
                type: 'oauth',
                token: githubAccessToken
            });
            const getRepoAsync = promisify(githubApi.repos.get);
            const repoInfo = await getRepoAsync({ user: info.owner, repo: info.repo});
            return repoInfo.private;
        } else {
            return info.private;
        }
    }
}
