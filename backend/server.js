const express = require("express");
const cors = require("cors");
const OpenAI = require("openai");
require("dotenv").config();

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.get("/api/hello", (req, res) => {
  res.send("Hello from the backend!");
});

app.post("/api/chat", async (req, res) => {
  try {
    const { message } = req.body;
    const prompt = message;

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: prompt },
      ],
    });

    const aiResponse = completion.choices[0].message.content;
    res.json({ reply: aiResponse });
  } catch (error) {
    console.error("Error calling OpenAI API:", error);
    res.status(500).json({ error: "Failed to get response from AI." });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on localhost port: ${PORT}`);
});
