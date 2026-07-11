const express = require("express");
const { db, admin } = require("../firebaseAdmin");
const { verifyToken } = require("../middleware/verifyToken");

const router = express.Router();

// POST /api/users/profile → called once right after signup to create the Firestore user doc
router.post("/profile", verifyToken, async (req, res) => {
  try {
    const { displayName } = req.body;
    const ref = db.collection("users").doc(req.user.uid);
    const doc = await ref.get();

    if (!doc.exists) {
      await ref.set({
        displayName: displayName || req.user.email?.split("@")[0] || "User",
        email: req.user.email,
        isAdmin: false,
        themeColor: null, // null = "use the global default"
        aiName: "Jarvis", // default assistant name; user can rename in Settings
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
    const finalDoc = await ref.get();
    res.json({ id: finalDoc.id, ...finalDoc.data() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/users/me
router.get("/me", verifyToken, async (req, res) => {
  try {
    const doc = await db.collection("users").doc(req.user.uid).get();
    if (!doc.exists) return res.status(404).json({ error: "Profile not found" });
    res.json({ id: doc.id, ...doc.data() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/users/me/theme → { themeColor: "#RRGGBB" | null }
// Only takes effect client-side if appConfig.global.allowUserThemeOverride is true —
// enforced by the client UI, but we double check server-side too for safety.
router.put("/me/theme", verifyToken, async (req, res) => {
  try {
    const configDoc = await db.collection("appConfig").doc("global").get();
    const allowOverride = configDoc.exists ? !!configDoc.data().allowUserThemeOverride : false;

    if (!allowOverride && !req.user.isAdmin) {
      return res.status(403).json({ error: "Custom themes are disabled by the admin right now" });
    }

    const { themeColor } = req.body;
    await db.collection("users").doc(req.user.uid).set({ themeColor }, { merge: true });
    res.json({ ok: true, themeColor });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/users/me/ai-name → { aiName: "Jarvis" } — the wake word / in-chat
// trigger name this user has given their assistant. Personal, not global.
router.put("/me/ai-name", verifyToken, async (req, res) => {
  try {
    const { aiName } = req.body;
    if (!aiName || !aiName.trim()) {
      return res.status(400).json({ error: "aiName is required" });
    }
    await db.collection("users").doc(req.user.uid).set(
      { aiName: aiName.trim() },
      { merge: true }
    );
    res.json({ ok: true, aiName: aiName.trim() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = { router };
