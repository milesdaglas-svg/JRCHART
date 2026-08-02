const express = require("express");
const { db, admin } = require("../firebaseAdmin");
const { verifyToken } = require("../middleware/verifyToken");

const router = express.Router();

// Google Gemini has a genuinely free tier (no billing card required). Each
// user gets their own key at https://aistudio.google.com/apikey and saves it
// in Settings — it's stored on their Firestore user doc as `geminiApiKey`
// and used only for that user's own requests. No shared server-wide key.
const GEMINI_MODEL = "gemini-3.5-flash-lite";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

// Fetches the calling user's own key. Throws a friendly, client-safe error
// if they haven't set one yet so the UI can point them at Settings.
async function getUserGeminiKey(uid) {
  const doc = await db.collection("users").doc(uid).get();
  const key = doc.exists ? doc.data().geminiApiKey : null;
  if (!key) {
    throw new Error("NO_GEMINI_KEY");
  }
  return key;
}

async function askGemini(apiKey, systemPrompt, userPrompt) {
  const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Gemini request failed: ${res.status} ${body}`);
  }

  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.map((p) => p.text).join("").trim() || "";
}

async function getRecentMessages(groupId, limit = 12) {
  const snap = await db
    .collection("groups")
    .doc(groupId)
    .collection("messages")
    .orderBy("createdAt", "desc")
    .limit(limit)
    .get();
  return snap.docs
    .map((d) => d.data())
    .reverse()
    .map((m) => `${m.senderId}: ${m.text}`)
    .join("\n");
}

// POST /api/ai/compose  { groupId, instruction }
// Triggered when a user types their assistant's name in a chat, e.g.
// "Jarvis, tell him I'm running 10 min late". The AI drafts a reply using
// that chat's recent context and posts it to the chat on the user's behalf.
router.post("/compose", verifyToken, async (req, res) => {
  try {
    const { groupId, instruction } = req.body;
    if (!groupId || !instruction) {
      return res.status(400).json({ error: "groupId and instruction are required" });
    }

    const groupDoc = await db.collection("groups").doc(groupId).get();
    if (!groupDoc.exists) return res.status(404).json({ error: "Group not found" });

    const apiKey = await getUserGeminiKey(req.user.uid);
    const history = await getRecentMessages(groupId);

    const draftText = await askGemini(
      apiKey,
      "You are a helpful messaging assistant drafting one chat reply on " +
        "behalf of the app's user. Keep it short, natural, and in the voice " +
        "of a real person texting - no greetings-as-headers, no signing off, " +
        "just the message text itself. Never add quotation marks around it.",
      `Recent conversation (most recent last):\n${history || "(no messages yet)"}\n\n` +
        `The user's instruction for what to reply: "${instruction}"\n\n` +
        "Write just the reply message, nothing else."
    );

    const msgRef = await db
      .collection("groups")
      .doc(groupId)
      .collection("messages")
      .add({
        senderId: req.user.uid,
        text: draftText,
        isAiGenerated: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

    res.status(201).json({ id: msgRef.id, text: draftText });
  } catch (err) {
    if (err.message === "NO_GEMINI_KEY") {
      return res.status(400).json({ error: "Add your Gemini API key in Settings to use the AI assistant." });
    }
    console.error("AI compose failed:", err.message);
    res.status(500).json({ error: "AI couldn't draft a reply right now" });
  }
});

// POST /api/ai/command  { transcript, availableGroups: [{id,name}], activeGroupId }
// Used by the wake-word voice assistant. The user speaks a command like
// "reply to Lisa saying I'll call you in ten minutes" — the model figures out
// which chat and what to send, and returns structured JSON. The client is
// responsible for actually executing the send (keeps the AI from silently
// doing things the client can't confirm/display).
router.post("/command", verifyToken, async (req, res) => {
  try {
    const { transcript, availableGroups = [], activeGroupId } = req.body;
    if (!transcript) return res.status(400).json({ error: "transcript is required" });

    const apiKey = await getUserGeminiKey(req.user.uid);
    const groupList = availableGroups.map((g) => `- ${g.name} (id: ${g.id})`).join("\n");

    const raw = await askGemini(
      apiKey,
      "You are a voice assistant embedded in a chat app. The user just " +
        "spoke a command after a wake word. Decide if they want to send a " +
        "message to one of their chats, and if so, to which one and with " +
        "what text. Respond with ONLY valid JSON, no markdown fences, no " +
        "commentary, in this exact shape:\n" +
        '{"action": "send" | "none", "groupId": "string or null", ' +
        '"message": "string or null", "speech": "short spoken confirmation"}\n' +
        "If the command doesn't clearly name one of the available chats and " +
        "isn't an obvious continuation for the currently open chat, use " +
        '"action": "none" and explain briefly in "speech".',
      `Available chats:\n${groupList || "(none)"}\n\n` +
        `Currently open chat id: ${activeGroupId || "none"}\n\n` +
        `Spoken command: "${transcript}"`
    );

    let parsed;
    try {
      parsed = JSON.parse(raw.replace(/^```json\s*|\s*```$/g, ""));
    } catch {
      parsed = { action: "none", groupId: null, message: null, speech: "I didn't quite catch that." };
    }

    res.json(parsed);
  } catch (err) {
    if (err.message === "NO_GEMINI_KEY") {
      return res.status(400).json({ error: "Add your Gemini API key in Settings to use the voice assistant." });
    }
    console.error("AI command failed:", err.message);
    res.status(500).json({ error: "AI couldn't process that command right now" });
  }
});

async function getUserElevenLabsKey(uid) {
  const doc = await db.collection("users").doc(uid).get();
  const key = doc.exists ? doc.data().elevenLabsApiKey : null;
  if (!key) throw new Error("NO_ELEVENLABS_KEY");
  return key;
}

const ELEVENLABS_VOICE_ID = "Cz0K1kOv9tD8l0b5Qu53";

router.post("/speak", verifyToken, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ error: "text is required" });
    }
    const apiKey = await getUserElevenLabsKey(req.user.uid);
    const elevenRes = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "xi-api-key": apiKey },
        body: JSON.stringify({ text: text.trim(), model_id: "eleven_flash_v2_5" }),
      }
    );
    if (!elevenRes.ok) {
      const errBody = await elevenRes.text();
      throw new Error(`ElevenLabs request failed: ${elevenRes.status} ${errBody}`);
    }
    const arrayBuffer = await elevenRes.arrayBuffer();
    const audioBase64 = Buffer.from(arrayBuffer).toString("base64");
    res.json({ audioBase64 });
  } catch (err) {
    if (err.message === "NO_ELEVENLABS_KEY") {
      return res.status(400).json({ error: "NO_ELEVENLABS_KEY" });
    }
    console.error("TTS failed:", err.message);
    res.status(500).json({ error: "Couldn't generate speech right now" });
  }
});

module.exports = { router };