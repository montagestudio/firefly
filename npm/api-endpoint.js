module.exports = (endpoint) => async (req, res, next) => {
    req.body = req.body || {};
    try {
        await endpoint(req, res, next);
    } catch (e) {
        next(e);
    }
};
