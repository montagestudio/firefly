module.exports = (endpoint) => async (req, res, next) => {
    req.body = req.body || {};
    try {
        result = await endpoint(req, res, next);
    } catch (e) {
        next(e);
    }
};
