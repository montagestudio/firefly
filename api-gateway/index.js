const express = require("express");
const routes = require('./routes');
const axios = require('axios');
const jwt = require('./middleware/jwt');

const app = express();

routes(app, axios, jwt(axios));

app.listen(80);
console.log("Listening on port 80");
