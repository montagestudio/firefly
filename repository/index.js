const express = require("express");
const routes = require("./routes.js");
const git = require("nodegit");

const app = express();

routes(app, git);

app.listen(80);
console.log("Listening on port 80");
