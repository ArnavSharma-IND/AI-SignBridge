import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());

const PORT = 3000;

// Initialize Gemini client lazily to avoid crashing on launch if the API key is temporarily absent
let aiClient: GoogleGenAI | null = null;

function getGeminiClient() {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn("GEMINI_API_KEY is not defined in the environment. Falling back to mock model results.");
      return null;
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// REST Endpoint: AI Sentence Correction and Context-Aware Translation
app.post("/api/translate/correct", async (req, res) => {
  const { text, language, context } = req.body;

  if (!text || typeof text !== "string") {
    return res.status(400).json({ error: "Missing or invalid 'text' field." });
  }

  const targetLanguage = language || "English";
  const userContext = context || "General Conversation";

  const ai = getGeminiClient();

  // Graceful fallback if Gemini API key isn't setup
  if (!ai) {
    // Generate intelligent mock response based on language to keep the UI perfectly functional
    let mockCorrectedWords: Record<string, Record<string, string>> = {
      "English": {
        "I WANT WATER PLEASE": "I would like some water, please.",
        "SOS HELP DANGER": "Emergency! I need safety assistance immediately.",
        "HELLO HOW ARE YOU": "Hello, how are you doing today?",
        "THANK YOU": "Thank you very much.",
        "HELP": "Please help me.",
        "DEFAULT": `Processed: ${text} in ${targetLanguage}`
      },
      "Hindi": {
        "I WANT WATER PLEASE": "कृपया मुझे थोड़ा पानी चाहिए।",
        "SOS HELP DANGER": "आपातकाल! मुझे तुरंत सहायता की आवश्यकता है।",
        "HELLO HOW ARE YOU": "नमस्ते, आप आज कैसे हैं?",
        "THANK YOU": "आपका बहुत-बहुत धन्यवाद।",
        "HELP": "कृपया मेरी मदद करें।",
        "DEFAULT": `हिन्दी अनुवाद: ${text}`
      },
      "Bengali": {
        "I WANT WATER PLEASE": "দয়া করে আমাকে একটু জল দিন।",
        "SOS HELP DANGER": "জরুরী অবস্থা! দয়া করে আমাকে অবিলম্বে সাহায্য করুন।",
        "HELLO HOW ARE YOU": "হ্যালো, আপনি কেমন আছেন?",
        "THANK YOU": "আপনাকে অনেক ধন্যবাদ।",
        "HELP": "দয়া করে আমাকে সাহায্য করুন।",
        "DEFAULT": `বাংলা অনুবাদ: ${text}`
      },
      "Marathi": {
        "I WANT WATER PLEASE": "कृपया मला थोडे पाणी हवे आहे.",
        "SOS HELP DANGER": "आणीबाणी! मला त्वरित मदतीची आवश्यकता आहे.",
        "HELLO HOW ARE YOU": "नमस्कार, तुम्ही कसे आहात?",
        "THANK YOU": "खूप खूप धन्यवाद.",
        "HELP": "कृपया मला मदत करा.",
        "DEFAULT": `मराठी अनुवाद: ${text}`
      }
    };

    const cleanInput = text.trim().toUpperCase();
    const langDict = mockCorrectedWords[targetLanguage] || mockCorrectedWords["English"];
    const correctedText = langDict[cleanInput] || langDict["DEFAULT"] || `Translated: ${text} (${targetLanguage})`;

    return res.json({
      correctedText,
      originalText: text,
      targetLanguage,
      contextPrediction: `Estimated from offline template based on: ${userContext}`,
      isDemo: true,
    });
  }

  try {
    const promptText = `The user signed this raw gesture sequence: "${text}".
Current context of conversation: "${userContext}".
Please correct this raw speech-to-gesture string into a polished, polite, grammatically perfect sentence written in the correct script/alphabet of the target language "${targetLanguage}".
Align the output to the cultural nuances of "${targetLanguage}".`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: promptText,
      config: {
        systemInstruction: `You are the core AI translation engine of AI SignBridge. Your mission is to take fragmented sign language gestures (such as "I WANT WATER PLEASE", "HELLO HELP", or single letters) and reconstruct them into grammatically complete, natural, and polite sentences in the requested target language ("English", "Hindi", "Bengali", or "Marathi"). Keep the translation context-aware and natural.
Respond STRICTLY with a JSON object containing target fields: "correctedText", "originalText", "targetLanguage", and "contextPrediction".`,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            correctedText: {
              type: Type.STRING,
              description: "The complete, polished, and polite sentence in the selected script/alphabet of the target language.",
            },
            originalText: {
              type: Type.STRING,
              description: "The raw gesture input sent by the client.",
            },
            targetLanguage: {
              type: Type.STRING,
              description: "The name of the target language requested.",
            },
            contextPrediction: {
              type: Type.STRING,
              description: "A short, helpful prediction about the user's intent or current emotional urgency (e.g. 'Emergency Request', 'Casual Greeting', 'Thirst/Need').",
            },
          },
          required: ["correctedText", "originalText", "targetLanguage", "contextPrediction"],
        },
      },
    });

    const outputText = response.text;
    if (!outputText) {
      throw new Error("No text returned from Gemini API.");
    }

    const parsedData = JSON.parse(outputText);
    return res.json({
      ...parsedData,
      isDemo: false
    });
  } catch (error: any) {
    console.error("Gemini correction error:", error);
    return res.status(500).json({
      error: "Failed to correct sentence via Gemini AI.",
      details: error.message,
    });
  }
});

// Serve Vite client assets / index.html
async function setupServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("Mounted Vite development middleware");
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
    console.log("Serving static production assets from /dist");
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`AI SignBridge backend active on http://0.0.0.0:${PORT}`);
  });
}

setupServer();
