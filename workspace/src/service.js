const fs = require('fs');
const path = require('path');
const rimraf = require('rimraf');
const { promisify } = require('util');

const readdirAsync = promisify(fs.readdir);
const rimrafAsync = promisify(rimraf);

module.exports = (workspacesHome) => ({
    getWorkspace: async (call, callback) => {
        const { user, owner, repo } = call.request;
        try {
            await readdirAsync(path.join(workspacesHome, user.name, owner, repo));
            callback(null, {
                id: call.request,
                status: 'initialized'
            });
        } catch (err) {
            callback(new Error('Workspace does not exist'));
        }
    },

    listWorkspaces: async (call) => {
        const { name } = call.request;
        const userPath = path.join(workspacesHome, name);
        try {
            const owners = await readdirAsync(userPath);
            for (let owner of owners) {
                const repos = await readdirAsync(path.join(userPath, owner));
                for (let repo of repos) {
                    call.write({
                        id: {
                            user: call.request,
                            owner,
                            repo
                        },
                        status: 'initialized'
                    });
                }
            }
        } catch (error) { }
        call.end();
    },

    deleteWorkspaces: async (call, callback) => {
        const { name } = call.request;
        const userPath = path.join(workspacesHome, name);
        try {
            await rimrafAsync(userPath);
        } catch (error) { }
        callback(null, {});
    }
});
