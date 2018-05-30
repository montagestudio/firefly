/**
 * Express middleware that reads the request's authorization header and makes
 * a request to the jwt service to extract the jwt profile. If successful, the
 * profile is added under `res.locals.profile` and the github token is added
 * under `res.locals.token`.
 * @param {Object} requestModule An axios-like object that the middleware
 * will use to make a request to the jwt service.
 */
function middleware(requestModule) {
    return async (req, res, next) => {
        const accessToken = req.headers['x-access-token'];
        if (!accessToken) {
            return next(new InvalidJWTError("No access token provided."));
        }
        const requestOptions = {
            headers: {
                "Authentication": `Bearer ${accessToken}`
            }
        };
        try {
            const { data } = await requestModule.get("http://jwt/profile", requestOptions);
            res.locals.profile = data.profile;
            res.locals.token = data.token;
            next();
        } catch (error) {
            if (error.response && error.response.status === 400) {
                next(new InvalidJWTError(error.response.data));
            } else {
                next(new JWTServiceUnreachableError());
            }
        }
    };
}
module.exports = middleware;

class InvalidJWTError extends Error {}
module.exports.InvalidJWTError = InvalidJWTError;

class JWTServiceUnreachableError extends Error {}
module.exports.JWTServiceUnreachableError = JWTServiceUnreachableError;
