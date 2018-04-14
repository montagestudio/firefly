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

app.post("/login", (req, res, next) => {
    const { body } = req;
    jwt.sign(body, privateKey, (err, token) => {
        if (err) {
            next(err);
        } else {
            res.send(token);
        }
    });
});

app.use((err, res) => {
    res.status(500);
    console.error(err);
    res.end(err.message);
});

app.listen(80);
console.log("Listening on port 80");
