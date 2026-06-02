const express = require("express");
const cors = require("cors");
require("dotenv").config(); 
const db = require("./config/db"); 
const adminRoutes = require("./routes/adminRoutes");

const app = express();
const port = 5050;

app.use(cors());
app.use(express.json()); 

app.get("/", (req, res) => {
    res.send("server is working");
});

app.use("/api/admin", adminRoutes);

app.listen(port, () => {
    console.log("server is running");
});