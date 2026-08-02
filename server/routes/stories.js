const express = require("express");
const { db, admin } = require("../firebaseAdmin");
const { verifyToken } = require("../middleware/verifyToken");

const router = express.Router();
const DAY_MS = 24 * 60 * 60 * 1000;

// GET /api/stories → all non-expired stories, newest first
router.get("/", verifyToken, async (req, res) => {
  try {
    const now = Date.now();
    const snap = await db
      .collection("stories")
      .orderBy("createdAt", "desc")
      .get();

    const stories = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((s) => {
        const created = s.createdAt?.toMillis ? s.createdAt.toMillis() : now;
        return now - created < DAY_MS;
      });

    res.json(stories);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/stories → { text?, mediaBase64? }
// mediaBase64 is a data URL (e.g. "data:image/jpeg;base64,...") produced by
// client-side compression — stored directly in Firestore since there's no
// Storage bucket (that requires a linked billing account).
router.post("/", verifyToken, async (req, res) => {
  try {
    const { text, mediaBase64 } = req.body;
    if (!text && !mediaBase64) {
      return res.status(400).json({ error: "Story needs text or a photo" });
    }
    if (mediaBase64 && mediaBase64.length > 900_000) {
      return res.status(413).json({ error: "That photo is too large — try a smaller one" });
    }

    const ref = await db.collection("stories").add({
      userId: req.user.uid,
      text: text || null,
      mediaBase64: mediaBase64 || null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    res.status(201).json({ id: ref.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Optional: a cleanup sweep you can call from a scheduled job/cron
// to physically delete expired stories instead of just filtering them out.
router.delete("/cleanup-expired", verifyToken, async (req, res) => {
  try {
    const now = Date.now();
    const snap = await db.collection("stories").get();
    const batch = db.batch();
    let count = 0;

    snap.docs.forEach((doc) => {
      const created = doc.data().createdAt?.toMillis?.() || now;
      if (now - created >= DAY_MS) {
        batch.delete(doc.ref);
        count++;
      }
    });

    await batch.commit();
    res.json({ deleted: count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = { router };
