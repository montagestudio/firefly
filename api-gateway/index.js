const express = require("express");
const routes = require('./routes');
const axios = require('axios');
const jwt = require('./middleware/jwt');

const app = express();

const axiosInstance = axios.create({
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    }
});

routes(app, axiosInstance, jwt(axiosInstance));

app.listen(80);
console.log("Listening on port 80");
