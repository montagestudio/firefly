const ApiError = require('../api-error');

class NpmApi {
    constructor(request) {
        this.request = request;
    }

    async installDependencies(path) {
        try {
            await this.request.post(`http://npm/package/install`, {
                prefix: path
            });
        } catch (error) {
            if (error.response) {
                throw new ApiError(error.response.data, error.response.status);
            } else {
                throw new ApiError('npm service failure', 503);
            }
        }
    }
}
module.exports = NpmApi;
