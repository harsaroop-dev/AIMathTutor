const express = require("express");
const app = express();
const PORT = 3001;

app.get('/api/hello',(req, res) => {
    res.send('Hello from the backend!');
});

app.listen(PORT, ()=>{
    console.log(`Server is running on localhost port: ${PORT}`);
});