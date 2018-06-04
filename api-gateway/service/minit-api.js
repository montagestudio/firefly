const ApiError = require('../api-error');

class MinitApi {
    constructor(request) {
        this.request = request;
    }

    async createApp(path, name) {
        try {
            await this.request.post(`http://minit/app/${name}?path=${path}`);
        } catch (error) {
            if (error.response) {
                throw new ApiError(error.response.data, error.response.status);
            } else {
                throw new ApiError('minit service failure', 503);
            }
        }
    }
}
module.exports = MinitApi;
