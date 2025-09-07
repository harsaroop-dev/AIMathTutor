const express = require("express");
const cors = require("cors");
const { z } = require("zod");
const OpenAI = require("openai");
const { spawn, exec } = require("child_process");
const fs = require("fs");
const path = require("path");
// const { v4: uuidv4 } = require("uuid");
require("dotenv").config();

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// app.use(express.static("public"));
app.use(express.static(path.join(__dirname, "public")));

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const getVideoDuration = (filePath) => {
  return new Promise((resolve, reject) => {
    const command = `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`;

    exec(command, (error, stdout, stderr) => {
      if (error) {
        return reject(new Error(`ffprobe error: ${error.message}`));
      }
      if (stderr) {
        return reject(new Error(`ffprobe stderr: ${stderr}`));
      }
      resolve(parseFloat(stdout));
    });
  });
};

const generateCaptions = async (manimCode, videoDuration) => {
  const prompt = `
    You are a math youtuber who focuses on creating short form content in youtube shorts. You are also a expert in manim. You will be given a manim code. You have to generate a voiceover for the manim animation. you are given the manim code for pythagoras theorem. Give me a good voiceover.

    **The final video is exactly ${Math.round(
      videoDuration
    )} seconds long.** Please create a well-paced and engaging voiceover script that fits perfectly within this timeframe.

    Respond ONLY with a JSON object containing a single key "captions".

    Manim Code:
    \`\`\`python
    ${manimCode}
    \`\`\`
  `;

  const completion = await openai.chat.completions.create({
    // model: "gpt-4o-2024-11-20",
    model: "gpt-5-nano",

    messages: [
      {
        role: "system",
        content:
          "You are a helpful narrator and director that provides responses in JSON format.",
      },
      { role: "user", content: prompt },
    ],
    response_format: { type: "json_object" },
  });

  const responseContent = completion.choices[0].message.content;
  const responseJson = JSON.parse(responseContent);
  return responseJson.captions || [];
};

const renderManim = (code) => {
  return new Promise((resolve, reject) => {
    const sceneNameMatch = code.match(/class\s+([a-zA-Z0-9_]+)\(Scene\):/);
    if (!sceneNameMatch) {
      return reject(new Error("No valid Manim scene found in code."));
    }
    const sceneName = sceneNameMatch[1];

    const scriptsDir = path.join(__dirname, "manim-script");
    if (!fs.existsSync(scriptsDir)) {
      fs.mkdirSync(scriptsDir, { recursive: true });
    }

    const timestampId = new Date().toISOString().replace(/[:.]/g, "-");

    const tempPyFile = path.join(scriptsDir, `${timestampId}.py`);
    const outputFileName = `${sceneName}_${timestampId}`;

    let correctedCode = code
      .replace(
        /axes\.get_tangent_line\(\s*([a-zA-Z0-9_]+)\s*,.+?\)/gi,
        "axes.get_derivative_graph($1)"
      )
      .replace(/Animate\((.*?)\)/g, "$1.animate")
      .replace(/ShowCreation/g, "Create");

    if (!correctedCode.trim().startsWith("from manim import *")) {
      correctedCode = "from manim import *\n\n" + correctedCode;
    }

    fs.writeFileSync(tempPyFile, correctedCode);
    console.log(tempPyFile);

    const manimProcess = spawn("manim", [
      "-ql",
      tempPyFile,
      sceneName,
      "--media_dir",
      "./public",
      "-o",
      outputFileName,
    ]);

    let stderr = "";
    manimProcess.stderr.on("data", (data) => {
      stderr += data.toString();
      console.error(`Manim stderr: ${data}`);
    });

    manimProcess.on("close", (code) => {
      // fs.unlinkSync(tempPyFile);

      if (code === 0) {
        const videoUrl = `/videos/${timestampId}/480p15/${outputFileName}.mp4`;
        const videoPath = path.join(__dirname, "public", videoUrl);
        resolve({ videoUrl, videoPath });
      } else {
        reject(
          new Error(`Manim failed with exit code ${code}. Error: ${stderr}`)
        );
      }
    });
  });
};

const generateSrtFile = async (manimCode, captions, videoDuration) => {
  // We format the captions array into a numbered list for the prompt
  // const captionsText = captions
  //   .map((cap, index) => `${index + 1}. "${cap}"`)
  //   .join("\n");

  const prompt = `
    You are an expert video editor who synchronizes audio narration with animations.
    You will receive the Python code for a Manim animation, a numbered list of voiceover captions, and the video's total duration.

    Your task is to generate an SRT file. You must analyze the Manim code to determine the precise timing of the visual events. Use this visual timing to assign accurate start and end timestamps for each caption line.

    The final output must contain only the valid SRT content. Do not include any extra text, code blocks, or explanations.

    provide a response in JSON format containing one key SRT-CONTENT and the value should be the raw srt content. Dont add anything to the srt file besides the srt content. no heading or anything. dont add backtick to it.

    **Video Duration**: ${videoDuration.toFixed(3)} seconds.
    **Narration Script**:
    ${captions}

    **Manim Code**:
    \`\`\`python
    ${manimCode}
    \`\`\`
  `;

  const completion = await openai.chat.completions.create({
    // model: "gpt-4o-2024-11-20",
    model: "gpt-5-nano",

    messages: [
      {
        role: "system",
        content:
          "You are an assistant that generates raw SRT file content as a single string.",
      },
      { role: "user", content: prompt },
    ],
  });

  const responseContent = completion.choices[0].message.content;
  const responseJson = JSON.parse(responseContent);

  return responseJson["SRT-CONTENT"] || [];
};
const addSubtitlesToVideo = (videoPath, originalVideoUrl, srtContent) => {
  return new Promise((resolve, reject) => {
    const tempSrtPath = videoPath.replace(".mp4", ".srt");
    const outputVideoPath = videoPath.replace(".mp4", "_subtitled.mp4");

    fs.writeFileSync(tempSrtPath, srtContent);

    let subtitlesFilterPath = tempSrtPath.replace(/\\/g, "/");

    if (process.platform === "win32") {
      subtitlesFilterPath = subtitlesFilterPath.replace(":", "\\:");
    }

    const command = `ffmpeg -i "${videoPath}" -vf "subtitles='${subtitlesFilterPath}'" -c:a copy -y "${outputVideoPath}"`;

    exec(command, (error, stdout, stderr) => {
      fs.unlinkSync(tempSrtPath);

      if (error) {
        console.error("FFmpeg stderr:", stderr);
        return reject(new Error(`FFmpeg failed to add subtitles: ${stderr}`));
      }

      const newVideoUrl = originalVideoUrl.replace(".mp4", "_subtitled.mp4");
      console.log(`Successfully created subtitled video: ${newVideoUrl}`);
      resolve(newVideoUrl);
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
      You are an expert Manim programmer. 
      Generate Python code that is guaranteed to run on **Manim Community v0.18**.
      Rules:
      - Use only official classes and methods from Manim v0.18.
      - Do not invent functions or classes like Polyline.
      - Output must be complete, runnable code with a Scene class and construct method.
      - Do not include explanations outside JSON.

      User's question: "${message}"
    `;

    //remove bottom 2 lines
    // const testManimFilePath = path.join(
    //   __dirname,
    //   "298af459-e6a4-4215-ae66-e18d93ffd922.py"
    // );
    // const localManimCode = fs.readFileSync(testManimFilePath, "utf-8");

    //uncomment later

    const completion = await openai.chat.completions.create({
      model: "gpt-5-nano",
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

    const aiResponseContent = completion.choices[0].message.content;
    const aiResponseJson = JSON.parse(aiResponseContent);

    // let videoUrl = null;
    // let captions = [];

    // try {
    //   console.log("Starting video rendering with local file...");
    //   const { videoUrl: url, videoPath } = await renderManim(localManimCode);
    //   videoUrl = url;
    //   console.log("Rendering complete. Video URL:", videoUrl);

    //   console.log("Getting video duration...");
    //   const duration = await getVideoDuration(videoPath);
    //   console.log(`Video duration is ${duration.toFixed(2)} seconds.`);

    //   console.log("Generating captions for the correct duration...");
    //   captions = await generateCaptions(localManimCode, duration);

    //   console.log("Caption generation complete. Captions:", captions);

    //   console.log("Generating SRT content...");
    //   const srtContent = await generateSrtFile(
    //     localManimCode,
    //     captions,
    //     duration
    //   );

    //   console.log("--- SRT FILE CONTENT START ---");
    //   console.log(srtContent);
    //   console.log("---  SRT FILE CONTENT END  ---");

    //   // NEW FINAL STEP: Add subtitles to the video using FFmpeg
    //   console.log("Adding subtitles to the video...");
    //   const finalVideoUrl = await addSubtitlesToVideo(videoPath, videoUrl, srtContent);

    //   // Update the videoUrl to point to the new subtitled video
    //   videoUrl = finalVideoUrl;
    //   console.log("Subtitles added. Final video URL:", videoUrl);

    // } catch (processError) {
    //   console.error(
    //     "Error during video processing or caption generation:",
    //     processError
    //   );
    // }

    // res.json({
    //   reply: "Test successful using local Manim file.",
    //   videoUrl: videoUrl,
    // });

    //uncomment later
    let videoUrl = null;
    let captions = [];
    if (aiResponseJson.manim_code) {
      try {
        const { videoUrl: url, videoPath } = await renderManim(
          aiResponseJson.manim_code
        );
        videoUrl = url;
        console.log("Rendering complete. Video URL:", videoUrl);

        const duration = await getVideoDuration(videoPath);
        console.log(`Video duration is ${duration.toFixed(2)} seconds.`);

        captions = await generateCaptions(aiResponseJson.manim_code, duration);
        console.log("Caption generation complete. Captions:", captions);

        const srtContent = await generateSrtFile(
          aiResponseJson.manim_code,
          captions,
          duration
        );
        console.log("--- SRT FILE CONTENT START ---");
        console.log(srtContent);
        console.log("---  SRT FILE CONTENT END  ---");

        console.log("Adding subtitles to the video...");
        const finalVideoUrl = await addSubtitlesToVideo(
          videoPath,
          videoUrl,
          srtContent
        );
        videoUrl = finalVideoUrl;
        console.log("Subtitles added. Final video URL:", videoUrl);
      } catch (processError) {
        console.error(
          "Error during video processing or caption generation:",
          processError
        );
        aiResponseJson.explanation +=
          "\n\n(Sorry, I was unable to generate the animation or captions for this.)";
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
