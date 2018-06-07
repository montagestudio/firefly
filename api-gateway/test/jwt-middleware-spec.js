const { expect } = require('chai');
const jwtMiddleware = require('../middleware/jwt');
const { InvalidJWTError, JWTServiceUnreachableError } = jwtMiddleware;
const { profile: mockProfile, token: mockToken, request: mockRequest } = require('./mocks/jwt-request-mock');

describe('jwt middleware', () => {
    it('passes on an InvalidJWTError if no access token is provided', (done) => {
        const middleware = jwtMiddleware(mockRequest);
        const req = { headers: {} };
        const res = {};
        const next = (err) => {
            expect(err instanceof InvalidJWTError).to.equal(true);
            done();
        }
        middleware(req, res, next);
    });


    it('passes on an InvalidJWTError if the access token is invalid', (done) => {
        const middleware = jwtMiddleware(mockRequest);
        const req = { headers: {'x-access-token': '123'} };
        const res = {};
        const next = (err) => {
            expect(err instanceof InvalidJWTError).to.equal(true);
            done();
        }
        middleware(req, res, next);
    });

    it('passes a JWTServiceUnreachableError if the jwt request fails for any other reason', (done) => {
        const mockUnreachableRequest = {
            get() {
                throw {
                    status: 408
                };
            }
        };
        const middleware = jwtMiddleware(mockUnreachableRequest);
        const req = { headers: {'x-access-token': 'abc'} };
        const res = {};
        const next = (err) => {
            expect(err instanceof JWTServiceUnreachableError).to.equal(true);
            done();
        }
        middleware(req, res, next);
    });

    it('puts the profile and token on res.locals if the request succeeds', (done) => {
        const middleware = jwtMiddleware(mockRequest);
        const req = { headers: {'x-access-token': 'abc'} };
        const res = { locals: {} };
        const next = (err) => {
            expect(err).to.be.undefined;
            expect(res.locals.profile).to.equal(mockProfile);
            expect(res.locals.token).to.equal(mockToken);
            done();
        }
        middleware(req, res, next);
    });
});