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

// POST /api/stories → { text?, mediaBase64?, videoUrl?, thumbnailUrl? }
// mediaBase64 is a data URL (e.g. "data:image/jpeg;base64,...") produced by
// client-side compression — stored directly in Firestore since there's no
// Storage bucket (that requires a linked billing account). Video stories
// go through Cloudinary instead, same as feed video posts.
router.post("/", verifyToken, async (req, res) => {
  try {
    const { text, mediaBase64, videoUrl, thumbnailUrl } = req.body;
    if (!text && !mediaBase64 && !videoUrl) {
      return res.status(400).json({ error: "Story needs text, a photo, or a video" });
    }
    if (mediaBase64 && mediaBase64.length > 900_000) {
      return res.status(413).json({ error: "That photo is too large — try a smaller one" });
    }

    const userDoc = await db.collection("users").doc(req.user.uid).get();

    const ref = await db.collection("stories").add({
      userId: req.user.uid,
      authorName: userDoc.data()?.displayName || "Someone",
      authorPhotoURL: userDoc.data()?.photoURL || null,
      text: text || null,
      mediaBase64: mediaBase64 || null,
      videoUrl: videoUrl || null,
      thumbnailUrl: thumbnailUrl || null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    res.status(201).json({ id: ref.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/stories/:id/view → record that the current user watched this
// story (skipped for the story's own owner). One doc per viewer, keyed by
// their uid, so repeat views don't pile up duplicates.
router.post("/:id/view", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const storyDoc = await db.collection("stories").doc(id).get();
    if (!storyDoc.exists) return res.status(404).json({ error: "Story not found" });
    if (storyDoc.data().userId === req.user.uid) return res.json({ ok: true });

    const userDoc = await db.collection("users").doc(req.user.uid).get();
    await db
      .collection("stories")
      .doc(id)
      .collection("views")
      .doc(req.user.uid)
      .set({
        viewerName: userDoc.data()?.displayName || "Someone",
        viewerPhotoURL: userDoc.data()?.photoURL || null,
        viewedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/stories/:id/views → who's watched this story — only the owner
// can see this, matching WhatsApp's privacy model for status views.
router.get("/:id/views", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const storyDoc = await db.collection("stories").doc(id).get();
    if (!storyDoc.exists) return res.status(404).json({ error: "Story not found" });
    if (storyDoc.data().userId !== req.user.uid) {
      return res.status(403).json({ error: "Only the story's owner can see who viewed it" });
    }

    const snap = await db
      .collection("stories")
      .doc(id)
      .collection("views")
      .orderBy("viewedAt", "desc")
      .get();
    res.json(snap.docs.map((d) => ({ userId: d.id, ...d.data() })));
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
