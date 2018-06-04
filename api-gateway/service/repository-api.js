const ApiError = require('../api-error');

class RepositoryApi {
    constructor(axios) {
        this.axios = axios;
    }

    async repositoryExists(path) {
        try {
            await this.axios.get(`http://repository/repository?path=${encodeURIComponent(path)}`);
            return true;
        } catch (error) {
            return false;
        }
    }

    async createRepository(path, remoteUrl, githubAccessToken, name, email) {
        try {
            const response = await this.axios.post('http://repository/repository', {
                path, remoteUrl, name, email
            });
            return response.body;
        } catch (error) {
            if (error.response) {
                throw new ApiError(error.response.data, error.response.status);
            } else {
                throw new ApiError(error, 500);
            }
        }
    }

    async cloneRepository(path, repositoryUrl, githubAccessToken, name, email) {
        try {
            const response = await this.axios.post('http://repository/repository', {
                path, repositoryUrl, name, email
            }, {
                headers: {
                    common: {
                        'x-github-access-token': githubAccessToken
                    }
                }
            });
            return response.body;
        } catch (error) {
            if (error.response) {
                throw new ApiError(error.response.data, error.response.status);
            } else {
                throw new ApiError(error, 500);
            }
        }
    }
}
module.exports = RepositoryApi;
