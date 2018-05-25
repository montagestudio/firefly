module.exports = (endpoint) => (req, res, next) => {
    req.body = req.body || {};
    return Promise.resolve(endpoint(req, res, next)).catch(next);
};
