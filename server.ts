/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

// Initialize the server-side Gemini client securely
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Set high limits for receiving recorded audio base64 streams
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // --- API ROUTE: Audio Transcription ---
  app.post("/api/transcribe", async (req, res) => {
    try {
      const { audio, mimeType } = req.body;
      if (!audio) {
        return res.status(400).json({ error: "Missing recorded audio data" });
      }

      const audioPart = {
        inlineData: {
          data: audio,
          mimeType: mimeType || "audio/webm"
        }
      };

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: [
          audioPart,
          "Please transcribe this meeting audio recording verbatim. Provide a highly accurate text transcription, segmenting paragraphs logically. If multiple speakers are detected, please label them as Speaker 1, Speaker 2, etc. dynamically based on their voice and flow. Do not summarize, just transcribe."
        ]
      });

      res.json({ transcript: response.text || "" });
    } catch (error: any) {
      console.error("Transcription error:", error);
      res.status(500).json({ error: error?.message || "Transcription failed" });
    }
  });

  // --- API ROUTE: Meeting Summarization & Structured Notes ---
  app.post("/api/summarize", async (req, res) => {
    try {
      const { transcript } = req.body;
      if (!transcript || transcript.trim() === "") {
        return res.status(400).json({ error: "Missing or empty meeting transcript" });
      }

      const summarySchema = {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING, description: "A concise, professional and descriptive title for the meeting." },
          summary: { type: Type.STRING, description: "A rich, comprehensive, executive summary of the meeting highlights." },
          keyPoints: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "Bullet points detailing the key topics, arguments, or discussion points discussed during the meeting."
          },
          decisions: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "A list of key decisions made or agreed upon."
          },
          actionItems: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                task: { type: Type.STRING, description: "The specific actionable task or next step." },
                assignee: { type: Type.STRING, description: "The name of the assignee (e.g., Sarah, John), or 'Unassigned' if not specified." },
                completed: { type: Type.BOOLEAN, description: "Always false initially." }
              },
              required: ["task", "assignee", "completed"]
            },
            description: "A checklist of action items or follow-ups identified in the meeting."
          },
          tags: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "3 to 5 tags or categories to organize and index this meeting."
          }
        },
        required: ["title", "summary", "keyPoints", "decisions", "actionItems", "tags"]
      };

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: [
          `Analyze the following meeting transcript. Generate structured meeting notes according to the specified schema, detailing the key discussion points, decisions made, an actionable task list with assignees, and up to 5 categories.\n\nMeeting Transcript:\n${transcript}`
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: summarySchema,
          systemInstruction: "You are an expert executive administrative assistant and agile scrum master. Your job is to capture the essence of a meeting, organizing it into beautifully readable, concise, and professional structured meeting notes."
        }
      });

      const parsedNotes = JSON.parse(response.text || "{}");
      res.json({ notes: parsedNotes });
    } catch (error: any) {
      console.error("Summarization error:", error);
      res.status(500).json({ error: error?.message || "Summarization failed" });
    }
  });

  // --- VITE MIDDLEWARE SETUP ---
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Server] Running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("[Server] Boot error:", err);
});
