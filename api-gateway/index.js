const express = require("express");
const routes = require('./routes');

const app = express();

const getJwtProfile = async (authHeader) => {
    const options = {
        headers: {
            'Authentication': authHeader
        }
    };
    const response = await request.get('http://jwt/profile', options);
    const { profile, token } = response.data;
    return { profile, token };
};

routes(app);

app.listen(80);
console.log("Listening on port 80");
