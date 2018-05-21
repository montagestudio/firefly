const express = require("express");
const routes = require('./routes');
const axios = require('axios');

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

routes(app, axios, getJwtProfile);

app.listen(80);
console.log("Listening on port 80");
