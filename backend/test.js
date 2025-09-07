const express = require("express");
const cors = require("cors");
const OpenAI = require("openai");
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
require("dotenv").config();

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
  
async function main() {
    const prompt = `
    You are a helpful math tutor. When a user asks for a visual explanation,
    provide a response in JSON format containing two keys: "explanation" (a clear, concise text explanation)
    and "manim_code" (the Python code using the Manim library to create a short, simple animation for the explanation).
    If no animation is necessary, return JSON with only the "explanation" key.
    The Manim code should be complete, runnable, and define a single class inheriting from Scene.
    You are an expert Manim programmer. 
    Generate Python code that is guaranteed to run on **Manim Community v0.18**.
    Rules:
    - Use only official classes and methods from Manim v0.18.
    - Do not invent functions or classes like Polyline.
    - Output must be complete, runnable code with a Scene class and construct method.
    - Do not include explanations outside JSON.

    User's question: explain pythagorean theorem with visuals
  `;

  console.log("SENDING REQ");
  const completion = await openai.chat.completions.create({
    model: "gpt-4o", // You can change this model name to test others
    messages: [
      {
        role: "system",
        content:
          "You are a helpful assistant that provides responses in JSON format.",
      },
      { role: "user", content: prompt },
    ],
    response_format: { type: "json_object" },
  });

  console.log(completion);
}

// --- Main Execution ---
(async () => {
    // Start the timer
    console.time("API Request Time");

    await main();

    // End the timer and log the duration
    console.timeEnd("API Request Time");
})();