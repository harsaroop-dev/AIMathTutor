const express = require("express");
const cors = require("cors");
const { z } = require("zod");
const OpenAI = require("openai");
const { spawn, exec } = require("child_process");
const fs = require("fs");
const path = require("path");
const openAiZod = require("openai/helpers/zod");
const zodResponseFormat = openAiZod.zodResponseFormat;
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

const SegmentSchema = z.object({
  start_time: z.number().describe("The start time of the segment in seconds."),
  end_time: z.number().describe("The end time of the segment in seconds."),
  text: z.string().describe("The voiceover dialogue for this segment."),
  video_visuals_description: z
    .string()
    .describe(
      "A detailed clear description of the visual elements and animation that should be displayed during this segment."
    ),
});

const ScriptSchema = z.object({
  explanation: z
    .string()
    .describe(
      "A clear and comprehensive screenplay for a math explanatory video."
    ),
  segments: z.array(SegmentSchema).describe("An array of timed captions."),
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

const generateCaptions = async (userMessage) => {
  // const prompt = `
  //   You are a math youtuber who focuses on creating short form content in youtube shorts. You are also a expert in manim. You will be given a manim code. You have to generate a voiceover for the manim animation. you are given the manim code for pythagoras theorem. Give me a good voiceover.

  //   **The final video is exactly ${Math.round(
  //     videoDuration
  //   )} seconds long.** Please create a well-paced and engaging voiceover script that fits perfectly within this timeframe.

  //   Respond ONLY with a JSON object containing a single key "captions".

  //   Manim Code:
  //   \`\`\`python
  //   ${manimCode}
  //   \`\`\`
  // `;
  const prompt = `
You are a professional short form math youtuber who does explanatory videos for youtube shorts. A user has requested a video from you.

You are now planning a video satisfying the user's query. The video will be 40 seconds long and have simple animations built using the manim animation library in python by a programmer.

For now you have to plan the entire video. In your plan include the voiceover and a description of what elements or animations to display/play on the screen while that voiceover is playing. Also include the timestamps for each voiceover-description combo. Be extremely detailed and comprehensive in your descriptions. Ensure that you weave a natural flow of your explanation with a combination of voiceover and what is displayed on the screen.

Don't do any channel logos, intros, outros, like, or subscribe etc. Directly go into the explanation.

**IMPORTANT**: The generated descriptions should have in depth details, determinism, and must be extremely comprehensive for the programmer to generate an acceptable video using manim.

The user has sent you the following query:
${userMessage}
`;
  const completion = await openai.chat.completions.parse({
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
    response_format: zodResponseFormat(ScriptSchema, "script_schema"),
  });

  const responseContent = completion.choices[0].message.content;
  const responseJson = JSON.parse(responseContent);

  const validatedScript = ScriptSchema.parse(responseJson);
  return validatedScript;
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

const generateManimCode = async (captions) => {
  const storyboard = captions
    .map((cap) => `- From ${cap.start_time}s to ${cap.end_time}s: ${cap.ideas}`)
    .join("\n");

  const totalDuration = captions[captions.length - 1].end_time;

  const prompt = `
    You are an expert Manim programmer. Your task is to write a complete, runnable Python script for a Manim animation based on a storyboard.

    You will be given a list of segments. Each segment will have a description of what visial elements/animations to show, a voiceover text which the voice actor will record over that segment, and a start and end time.

    Rules:
    - Use in depth thinking and reasoning
    - The final video must follow the spec shared in the visual description segments exactly. There is no room for deviations.
    - Use animation 'run_time' and 'self.wait()' to ensure the visual events happen at the correct times specified in the storyboard.
    - The output must be only the Python code, starting with 'from manim import *'.
    - The generated python code will be run on Manim Community v0.19.
    - Ensure correct and cohesive positioning and sizes of elements and text in the video.
    - Smartly remove old elements from the screen before rendering new elements, if the old ones are no longer needed for the rest of the video and/or if they will overlap with the newer elements.
    - Never call wait for <= 0 seconds, that leads to an exception.
    - Ensure that elements don't flow out from the screen.
    - **IMPORTANT: When defining points or vertices, always use a 1D list or a 1D NumPy array like '[x, y, z]' or 'np.array([x, y, z])'. NEVER use a nested array like 'np.array([[x, y, z]])'.**

    Storyboard:
    ${storyboard}
  `;

  const completion = await openai.chat.completions.create({
    model: "gpt-5",
    messages: [
      {
        role: "system",
        content:
          "You are a Manim code generator. You only output raw Python code.",
      },
      { role: "user", content: prompt },
    ],
  });

  return completion.choices[0].message.content;
};

const formatSrtTime = (timeInSeconds) => {
  const hours = Math.floor(timeInSeconds / 3600)
    .toString()
    .padStart(2, "0");
  const minutes = Math.floor((timeInSeconds % 3600) / 60)
    .toString()
    .padStart(2, "0");
  const seconds = Math.floor(timeInSeconds % 60)
    .toString()
    .padStart(2, "0");
  const milliseconds = Math.round(
    (timeInSeconds - Math.floor(timeInSeconds)) * 1000
  )
    .toString()
    .padStart(3, "0");

  return `${hours}:${minutes}:${seconds},${milliseconds}`;
};

const generateSrtFromCaptions = (captions) => {
  return captions
    .map((caption, index) => {
      const startTime = formatSrtTime(caption.start_time);
      const endTime = formatSrtTime(caption.end_time);
      return `${index + 1}\n${startTime} --> ${endTime}\n${caption.text}\n`;
    })
    .join("\n");
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

// app.post("/api/chat", async (req, res) => {
//   try {
//     const { message } = req.body;

//     const prompt = `
//       You are a helpful math tutor. When a user asks for a visual explanation,
//       provide a response in JSON format containing two keys: "explanation" (a clear, concise text explanation)
//       and "manim_code" (the Python code using the Manim library to create a short, simple animation for the explanation).
//       If no animation is necessary, return JSON with only the "explanation" key.
//       The Manim code should be complete, runnable, and define a single class inheriting from Scene.
//       You are an expert Manim programmer.
//       Generate Python code that is guaranteed to run on **Manim Community v0.18**.
//       Rules:
//       - Use only official classes and methods from Manim v0.18.
//       - Do not invent functions or classes like Polyline.
//       - Output must be complete, runnable code with a Scene class and construct method.
//       - Do not include explanations outside JSON.

//       User's question: "${message}"
//     `;

//     //remove bottom 2 lines
//     // const testManimFilePath = path.join(
//     //   __dirname,
//     //   "298af459-e6a4-4215-ae66-e18d93ffd922.py"
//     // );
//     // const localManimCode = fs.readFileSync(testManimFilePath, "utf-8");

//     //uncomment later

//     const completion = await openai.chat.completions.create({
//       model: "gpt-5-nano",
//       messages: [
//         {
//           role: "system",
//           content:
//             "You are a helpful assistant that provides responses in JSON format.",
//         },
//         { role: "user", content: prompt },
//       ],
//       response_format: { type: "json_object" },
//     });

//     const aiResponseContent = completion.choices[0].message.content;
//     const aiResponseJson = JSON.parse(aiResponseContent);

//     // let videoUrl = null;
//     // let captions = [];

//     // try {
//     //   console.log("Starting video rendering with local file...");
//     //   const { videoUrl: url, videoPath } = await renderManim(localManimCode);
//     //   videoUrl = url;
//     //   console.log("Rendering complete. Video URL:", videoUrl);

//     //   console.log("Getting video duration...");
//     //   const duration = await getVideoDuration(videoPath);
//     //   console.log(`Video duration is ${duration.toFixed(2)} seconds.`);

//     //   console.log("Generating captions for the correct duration...");
//     //   captions = await generateCaptions(localManimCode, duration);

//     //   console.log("Caption generation complete. Captions:", captions);

//     //   console.log("Generating SRT content...");
//     //   const srtContent = await generateSrtFile(
//     //     localManimCode,
//     //     captions,
//     //     duration
//     //   );

//     //   console.log("--- SRT FILE CONTENT START ---");
//     //   console.log(srtContent);
//     //   console.log("---  SRT FILE CONTENT END  ---");

//     //   // NEW FINAL STEP: Add subtitles to the video using FFmpeg
//     //   console.log("Adding subtitles to the video...");
//     //   const finalVideoUrl = await addSubtitlesToVideo(videoPath, videoUrl, srtContent);

//     //   // Update the videoUrl to point to the new subtitled video
//     //   videoUrl = finalVideoUrl;
//     //   console.log("Subtitles added. Final video URL:", videoUrl);

//     // } catch (processError) {
//     //   console.error(
//     //     "Error during video processing or caption generation:",
//     //     processError
//     //   );
//     // }

//     // res.json({
//     //   reply: "Test successful using local Manim file.",
//     //   videoUrl: videoUrl,
//     // });

//     //uncomment later
//     let videoUrl = null;
//     let captions = [];
//     if (aiResponseJson.manim_code) {
//       try {
//         const { videoUrl: url, videoPath } = await renderManim(
//           aiResponseJson.manim_code
//         );
//         videoUrl = url;
//         console.log("Rendering complete. Video URL:", videoUrl);

//         const duration = await getVideoDuration(videoPath);
//         console.log(`Video duration is ${duration.toFixed(2)} seconds.`);

//         captions = await generateCaptions(aiResponseJson.manim_code, duration);
//         console.log("Caption generation complete. Captions:", captions);

//         const srtContent = await generateSrtFile(
//           aiResponseJson.manim_code,
//           captions,
//           duration
//         );
//         console.log("--- SRT FILE CONTENT START ---");
//         console.log(srtContent);
//         console.log("---  SRT FILE CONTENT END  ---");

//         console.log("Adding subtitles to the video...");
//         const finalVideoUrl = await addSubtitlesToVideo(
//           videoPath,
//           videoUrl,
//           srtContent
//         );
//         videoUrl = finalVideoUrl;
//         console.log("Subtitles added. Final video URL:", videoUrl);
//       } catch (processError) {
//         console.error(
//           "Error during video processing or caption generation:",
//           processError
//         );
//         aiResponseJson.explanation +=
//           "\n\n(Sorry, I was unable to generate the animation or captions for this.)";
//       }
//     }

//     res.json({
//       reply: aiResponseJson.explanation,
//       videoUrl: videoUrl,
//     });
//   } catch (error) {
//     console.error("Error in /api/chat:", error);
//     res.status(500).json({ error: "Failed to get response from AI." });
//   }
// });

app.post("/api/chat", async (req, res) => {
  try {
    const { message } = req.body;

    console.log("Generating video script and storyboard...");
    const script = await generateCaptions(message);

    console.log("--- INITIAL SCRIPT JSON ---", JSON.stringify(script, null, 2));
    fs.writeFileSync("JSON.json", JSON.stringify(script, null, 2));

    const { explanation, segments } = script;
    const captions = segments;

    let videoUrl = null;

    if (captions && captions.length > 0) {
      try {
        console.log("Generating Manim code from ideas...");
        const manimCode = await generateManimCode(captions);

        console.log("Generating SRT content...");
        const srtContent = generateSrtFromCaptions(captions);
        console.log("--- SRT FILE CONTENT START ---");
        console.log(srtContent);
        console.log("---  SRT FILE CONTENT END  ---");

        console.log("Starting Manim video rendering...");
        const { videoUrl: rawVideoUrl, videoPath } = await renderManim(
          manimCode
        );
        console.log("Rendering complete. Raw video URL:", rawVideoUrl);

        console.log("Adding subtitles to the video...");
        const finalVideoUrl = await addSubtitlesToVideo(
          videoPath,
          rawVideoUrl,
          srtContent
        );
        videoUrl = finalVideoUrl;
        console.log("Subtitles added. Final video URL:", videoUrl);
      } catch (processError) {
        console.error(
          "Error during video processing or caption generation:",
          processError
        );
        script.explanation +=
          "\n\n(Sorry, I was unable to generate the animation for this.)";
      }
    }

    res.json({
      reply: explanation,
      videoUrl: videoUrl,
    });
  } catch (error) {
    console.error("Error in /api/chat:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "Invalid AI response structure.",
        details: error.errors,
      });
    }
    res.status(500).json({ error: "Failed to get response from AI." });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on localhost port: ${PORT}`);
});
