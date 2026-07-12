const express = require("express");
const { db, admin } = require("../firebaseAdmin");
const { verifyToken } = require("../middleware/verifyToken");

const router = express.Router();

// GET /api/posts → the feed, most recent 50 first
router.get("/", verifyToken, async (req, res) => {
  try {
    const snap = await db.collection("posts").orderBy("createdAt", "desc").limit(50).get();
    const posts = snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        userId: data.userId,
        authorName: data.authorName,
        text: data.text || null,
        mediaBase64: data.mediaBase64 || null,
        likeCount: data.likedBy?.length || 0,
        likedByMe: data.likedBy?.includes(req.user.uid) || false,
        commentCount: data.commentCount || 0,
        createdAt: data.createdAt,
      };
    });
    res.json(posts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/posts → { text?, mediaBase64? } — same no-billing base64 trick as stories
router.post("/", verifyToken, async (req, res) => {
  try {
    const { text, mediaBase64 } = req.body;
    if (!text && !mediaBase64) {
      return res.status(400).json({ error: "Post needs text or a photo" });
    }
    if (mediaBase64 && mediaBase64.length > 900_000) {
      return res.status(413).json({ error: "That photo is too large — try a smaller one" });
    }

    const userDoc = await db.collection("users").doc(req.user.uid).get();

    const ref = await db.collection("posts").add({
      userId: req.user.uid,
      authorName: userDoc.data()?.displayName || "Someone",
      text: text || null,
      mediaBase64: mediaBase64 || null,
      likedBy: [],
      commentCount: 0,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    res.status(201).json({ id: ref.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/posts/:id → only your own post
router.delete("/:id", verifyToken, async (req, res) => {
  try {
    const ref = db.collection("posts").doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: "Post not found" });
    if (doc.data().userId !== req.user.uid) {
      return res.status(403).json({ error: "You can only delete your own posts" });
    }

    const commentsSnap = await ref.collection("comments").get();
    const batch = db.batch();
    commentsSnap.docs.forEach((c) => batch.delete(c.ref));
    batch.delete(ref);
    await batch.commit();

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/posts/:id/like → toggles like on/off for the current user
router.post("/:id/like", verifyToken, async (req, res) => {
  try {
    const ref = db.collection("posts").doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: "Post not found" });

    const likedBy = doc.data().likedBy || [];
    const alreadyLiked = likedBy.includes(req.user.uid);

    await ref.update({
      likedBy: alreadyLiked
        ? admin.firestore.FieldValue.arrayRemove(req.user.uid)
        : admin.firestore.FieldValue.arrayUnion(req.user.uid),
    });

    res.json({ liked: !alreadyLiked });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/posts/:id/comments
router.get("/:id/comments", verifyToken, async (req, res) => {
  try {
    const snap = await db
      .collection("posts")
      .doc(req.params.id)
      .collection("comments")
      .orderBy("createdAt", "asc")
      .get();
    res.json(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/posts/:id/comments → { text }
router.post("/:id/comments", verifyToken, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text?.trim()) return res.status(400).json({ error: "Comment text required" });

    const userDoc = await db.collection("users").doc(req.user.uid).get();
    const postRef = db.collection("posts").doc(req.params.id);

    const commentRef = await postRef.collection("comments").add({
      userId: req.user.uid,
      authorName: userDoc.data()?.displayName || "Someone",
      text: text.trim(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    await postRef.update({ commentCount: admin.firestore.FieldValue.increment(1) });

    res.status(201).json({ id: commentRef.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = { router };
