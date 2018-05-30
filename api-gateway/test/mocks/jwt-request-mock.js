const profile = {
    username: 'mocha'
};
const token = 'xyz';
const request = {
    async get(url, options) {
        if (options && options.headers && options.headers['Authentication'] === 'Bearer abc') {
            return {
                status: 200,
                data: {
                    profile, token
                }
            };
        } else {
            throw {
                response: {
                    status: 400
                }
            };
        }
    }
};

module.exports = {
    profile, token, request
};
