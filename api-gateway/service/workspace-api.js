const ApiError = require('../api-error');

class WorkspaceApi {
    constructor(request) {
        this.request = request;
    }

    async listWorkspaces(user) {
        try {
            const response = await this.request.get(`http://workspace/workspaces${user ? `?user=${user}` : ''}`);
            return response.data;
        } catch (error) {
            if (error.response) {
                throw new ApiError(error.response.data, error.response.status);
            } else {
                throw new ApiError('workspace service failure', 503);
            }
        }
    }

    async deleteWorkspaces(user) {
        try {
            const response = await this.request.delete(`http://workspace/workspaces${user ? `?user=${user}` : ''}`);
            return response.data;
        } catch (error) {
            if (error.response) {
                throw new ApiError(error.response.data, error.response.status);
            } else {
                throw new ApiError('workspace service failure', 503);
            }
        }
    }
}
module.exports = WorkspaceApi;
