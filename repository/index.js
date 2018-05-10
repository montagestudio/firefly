const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");

const app = express();

app.use(bodyParser.json());
app.use(cors());

app.use((err, res) => {
    res.status(500);
    console.error(err);
    res.end(err.message);
});

app.listen(80);
console.log("Listening on port 80");
