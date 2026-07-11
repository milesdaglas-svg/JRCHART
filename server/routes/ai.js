const express = require("express");
const Anthropic = require("@anthropic-ai/sdk");
const { db, admin } = require("../firebaseAdmin");
const { verifyToken } = require("../middleware/verifyToken");

const router = express.Router();
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = "claude-sonnet-4-6";

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

    const history = await getRecentMessages(groupId);

    const completion = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 300,
      system:
        "You are a helpful messaging assistant drafting one chat reply on " +
        "behalf of the app's user. Keep it short, natural, and in the voice " +
        "of a real person texting - no greetings-as-headers, no signing off, " +
        "just the message text itself. Never add quotation marks around it.",
      messages: [
        {
          role: "user",
          content:
            `Recent conversation (most recent last):\n${history || "(no messages yet)"}\n\n` +
            `The user's instruction for what to reply: "${instruction}"\n\n` +
            "Write just the reply message, nothing else.",
        },
      ],
    });

    const draftText = completion.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();

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

    const groupList = availableGroups.map((g) => `- ${g.name} (id: ${g.id})`).join("\n");

    const completion = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 300,
      system:
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
      messages: [
        {
          role: "user",
          content:
            `Available chats:\n${groupList || "(none)"}\n\n` +
            `Currently open chat id: ${activeGroupId || "none"}\n\n` +
            `Spoken command: "${transcript}"`,
        },
      ],
    });

    const raw = completion.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();

    let parsed;
    try {
      parsed = JSON.parse(raw.replace(/^```json\s*|\s*```$/g, ""));
    } catch {
      parsed = { action: "none", groupId: null, message: null, speech: "I didn't quite catch that." };
    }

    res.json(parsed);
  } catch (err) {
    console.error("AI command failed:", err.message);
    res.status(500).json({ error: "AI couldn't process that command right now" });
  }
});

module.exports = { router };
