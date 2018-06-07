const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const jwt = require("jsonwebtoken");
const fs = require("fs");
const path = require("path");

const app = express();
const privateKey = fs.readFileSync(path.join(__dirname, "private.key"));

app.use(cors());
app.use(bodyParser.json());

app.post("/login", (req, res) => {
    const { body } = req;
    jwt.sign(body, privateKey, (err, token) => {
        if (err) {
            res.sendStatus(400);
        } else {
            res.send(token);
        }
    });
});

app.get("/profile", (req, res) => {
    const auth = req.headers.authentication;
    const token = auth && auth.split(" ")[1];
    jwt.verify(token, privateKey, (err, payload) => {
        if (err) {
            res.sendStatus(400);
        } else {
            res.send(payload);
        }
    });
});

app.listen(80);
console.log("Listening on port 80");
