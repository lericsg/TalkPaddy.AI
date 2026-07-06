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

// Helper function to dynamically fall back to gemini-3.1-flash-lite on 429 / 503 or quota errors
async function generateContentWithFallback(params: {
  contents: any[];
  config?: any;
}) {
  try {
    return await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: params.contents,
      config: params.config,
    });
  } catch (error: any) {
    const errorStr = (error?.message || "").toLowerCase();
    const isQuotaOrTransientError = 
      errorStr.includes("quota") || 
      errorStr.includes("rate-limit") || 
      errorStr.includes("429") || 
      errorStr.includes("resource_exhausted") ||
      errorStr.includes("exceeded your current quota") ||
      errorStr.includes("503") ||
      errorStr.includes("unavailable") ||
      errorStr.includes("high demand") ||
      errorStr.includes("temporarily") ||
      error?.status === 429 ||
      error?.code === 429 ||
      error?.status === 503 ||
      error?.code === 503;

    if (isQuotaOrTransientError) {
      console.warn("[Server] gemini-3.5-flash rate limit/quota/high-demand hit. Automatically falling back to gemini-3.1-flash-lite...");
      try {
        return await ai.models.generateContent({
          model: "gemini-3.1-flash-lite",
          contents: params.contents,
          config: params.config,
        });
      } catch (fallbackError: any) {
        console.error("[Server] Fallback to gemini-3.1-flash-lite also failed:", fallbackError);
        throw fallbackError;
      }
    }
    throw error;
  }
}

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

      const response = await generateContentWithFallback({
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

  // --- API ROUTE: Unified Meeting Processing (Transcription + Notes in 1 single API Call) ---
  // Optimizes quota usage and reduces API costs by 50%
  app.post("/api/process-meeting", async (req, res) => {
    try {
      const { audio, mimeType, realtimeTranscript, customTitle } = req.body;

      const schema = {
        type: Type.OBJECT,
        properties: {
          transcript: { 
            type: Type.STRING, 
            description: "Verbatim word-for-word text transcription of the meeting audio if provided. Group paragraphs logically and label speakers dynamically (e.g. Speaker 1, Speaker 2). If only text was provided, clean up grammar and typos and output it here." 
          },
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
        required: ["transcript", "title", "summary", "keyPoints", "decisions", "actionItems", "tags"]
      };

      const contents: any[] = [];
      let prompt = `You are an expert executive administrative assistant and agile scrum master. Your job is to capture the essence of a meeting, organizing it into beautifully readable, concise, and professional structured meeting notes.

Please do the following:
1. Generate a verbatim, high-accuracy transcription of the meeting in the 'transcript' field.
`;

      if (audio) {
        const audioPart = {
          inlineData: {
            data: audio,
            mimeType: mimeType || "audio/webm"
          }
        };
        contents.push(audioPart);
        
        prompt += `- Listen to the attached audio, and transcribe it word-for-word. Do not summarize, skip, or paraphrase. Segment into paragraphs logically and label speakers (e.g., 'Speaker 1:', 'Speaker 2:') dynamically based on their voice and dialogue flow.
- If a draft transcript is also provided as reference, use it to resolve spelling of names or technical terms, but prioritize transcribing the audio directly.
`;
        if (realtimeTranscript) {
          prompt += `\nReference draft transcript:\n${realtimeTranscript}\n`;
        }
      } else {
        if (!realtimeTranscript || realtimeTranscript.trim() === "") {
          return res.status(400).json({ error: "No audio data or transcript provided" });
        }
        prompt += `- Clean up the provided real-time draft transcript (correct spelling, punctuation, capitalization, and grammatical errors) and output it in the 'transcript' field.\n\nInput draft transcript:\n${realtimeTranscript}\n`;
      }

      prompt += `
2. Based on that transcription, analyze the content and generate:
- A professional, concise, and descriptive title.
- A rich, comprehensive executive summary of the meeting highlights.
- Bulleted key discussion points.
- Key decisions made or agreed upon.
- A checklist of action items or next steps, assigning them to the specified team member (or 'Unassigned' if unknown).
- 3 to 5 categories/tags for organization.`;

      if (customTitle && customTitle.trim() !== "") {
        prompt += `\n\n- IMPORTANT: The user has specified the meeting title as "${customTitle.trim()}". Please use this exact title for the "title" field in your JSON response.`;
      }

      contents.push(prompt);

      const response = await generateContentWithFallback({
        contents,
        config: {
          responseMimeType: "application/json",
          responseSchema: schema,
          systemInstruction: "You are an expert executive assistant. Your output MUST strictly match the requested JSON schema, transcribing first then generating meeting notes perfectly."
        }
      });

      const parsedNotes = JSON.parse(response.text || "{}");
      res.json({ notes: parsedNotes });
    } catch (error: any) {
      console.error("Unified meeting processing error:", error);
      res.status(500).json({ error: error?.message || "Failed to process meeting" });
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

      const response = await generateContentWithFallback({
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
