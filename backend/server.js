// index.js

const express = require("express");
const cors = require("cors");
const OpenAI = require("openai");
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
require("dotenv").config();

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// app.use(express.static("public"));
app.use(express.static(path.join(__dirname, 'public')));

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});


const renderManim = (code) => {
  return new Promise((resolve, reject) => {
    const sceneNameMatch = code.match(/class\s+([a-zA-Z0-9_]+)\(Scene\):/);
    if (!sceneNameMatch) {
      return reject(new Error("No valid Manim scene found in code."));
    }
    const sceneName = sceneNameMatch[1];
    const uniqueId = uuidv4();
    const tempPyFile = path.join(__dirname, `${uniqueId}.py`);
    const outputFileName = `${sceneName}_${uniqueId}`;

    let correctedCode = code
      .replace(/axes\.get_tangent_line\(\s*([a-zA-Z0-9_]+)\s*,.+?\)/gi, "axes.get_derivative_graph($1)")
      .replace(/Animate\((.*?)\)/g, "$1.animate")
      .replace(/ShowCreation/g, "Create");

    if (!correctedCode.trim().startsWith("from manim import *")) {
      correctedCode = "from manim import *\n\n" + correctedCode;
    }

    fs.writeFileSync(tempPyFile, correctedCode);

    const manimProcess = spawn("manim", [
      "-ql", tempPyFile, sceneName,
      "--media_dir", "./public",
      "-o", outputFileName,
    ]);

    let stderr = "";
    manimProcess.stderr.on("data", (data) => {
      stderr += data.toString();
      console.error(`Manim stderr: ${data}`);
    });

    manimProcess.on("close", (code) => {
      fs.unlinkSync(tempPyFile);

      if (code === 0) {
        const videoUrl = `/videos/${uniqueId}/480p15/${outputFileName}.mp4`;
        resolve(videoUrl);
      } else {
        reject(new Error(`Manim failed with exit code ${code}. Error: ${stderr}`));
      }
    });
  });
};

app.post("/api/chat", async (req, res) => {
  try {
    const { message } = req.body;

    const prompt = `
      You are a helpful math tutor. When a user asks for a visual explanation,
      provide a response in JSON format containing two keys: "explanation" (a clear, concise text explanation)
      and "manim_code" (the Python code using the Manim library to create a short, simple animation for the explanation).
      If no animation is necessary, return JSON with only the "explanation" key.
      The Manim code should be complete, runnable, and define a single class inheriting from Scene.
      User's question: "${message}"
    `;

    const completion = await openai.chat.completions.create({
      model: "gpt-4-turbo",
      messages: [
        { role: "system", content: "You are a helpful assistant that provides responses in JSON format." },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
    });

    const aiResponseContent = completion.choices[0].message.content;
    const aiResponseJson = JSON.parse(aiResponseContent);

    let videoUrl = null;
    if (aiResponseJson.manim_code) {
      try {
        console.log("Rendering Manim code...");
        videoUrl = await renderManim(aiResponseJson.manim_code);
        console.log("Rendering complete. Video URL:", videoUrl);
      } catch (renderError) {
        console.error("Manim rendering failed:", renderError);
        aiResponseJson.explanation += "\n\n(Sorry, I was unable to generate the animation for this.)";
      }
    }

    res.json({
      reply: aiResponseJson.explanation,
      videoUrl: videoUrl,
    });

  } catch (error) {
    console.error("Error in /api/chat:", error);
    res.status(500).json({ error: "Failed to get response from AI." });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on localhost port: ${PORT}`);
});