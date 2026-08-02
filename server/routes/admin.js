const express = require("express");
const { db } = require("../firebaseAdmin");
const { verifyToken, requireAdmin } = require("../middleware/verifyToken");

const router = express.Router();
const CONFIG_REF = () => db.collection("appConfig").doc("global");

// GET /api/admin/config → public-ish read (any logged-in user needs this
// to render the current theme), no admin requirement
router.get("/config", verifyToken, async (req, res) => {
  try {
    const doc = await CONFIG_REF().get();
    const data = doc.exists
      ? doc.data()
      : { themeColor: "#8b7fe8", allowUserThemeOverride: false };
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/admin/config  (admin only) → { themeColor?, allowUserThemeOverride? }
router.put("/config", verifyToken, requireAdmin, async (req, res) => {
  try {
    const { themeColor, allowUserThemeOverride } = req.body;
    const update = {};
    if (typeof themeColor === "string") update.themeColor = themeColor;
    if (typeof allowUserThemeOverride === "boolean") {
      update.allowUserThemeOverride = allowUserThemeOverride;
    }
    await CONFIG_REF().set(update, { merge: true });
    res.json({ ok: true, ...update });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/admin/users/:uid/promote (admin only) → make another user an admin
router.put("/users/:uid/promote", verifyToken, requireAdmin, async (req, res) => {
  try {
    await db.collection("users").doc(req.params.uid).set(
      { isAdmin: true },
      { merge: true }
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
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
