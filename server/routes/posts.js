const express = require("express");
const { db, admin } = require("../firebaseAdmin");
const { verifyToken } = require("../middleware/verifyToken");

const router = express.Router();

function extractTags(text) {
  if (!text) return [];
  const matches = text.match(/#[a-z0-9_]+/gi) || [];
  return [...new Set(matches.map((t) => t.toLowerCase()))];
}

function serializePost(d, myUid) {
  const data = d.data();
  return {
    id: d.id,
    userId: data.userId,
    authorName: data.authorName,
    text: data.text || null,
    mediaBase64: data.mediaBase64 || null,
    videoUrl: data.videoUrl || null,
    mediaType: data.videoUrl ? "video" : data.mediaBase64 ? "image" : "text",
    tags: data.tags || [],
    likeCount: data.likedBy?.length || 0,
    likedByMe: data.likedBy?.includes(myUid) || false,
    savedByMe: data.savedBy?.includes(myUid) || false,
    commentCount: data.commentCount || 0,
    createdAt: data.createdAt,
  };
}

// GET /api/posts → the feed. Optional ?tag=hashtag to browse one topic.
// With no tag, lightly reorders results toward tags the user has liked
// before (recency stays the tiebreaker) — a simple "topics you're into"
// pass without needing separate infrastructure.
router.get("/", verifyToken, async (req, res) => {
  try {
    const { tag } = req.query;
    let query = db.collection("posts").orderBy("createdAt", "desc").limit(80);
    if (tag) {
      query = db.collection("posts").where("tags", "array-contains", tag.toLowerCase()).limit(80);
    }
    const snap = await query.get();
    let posts = snap.docs.map((d) => serializePost(d, req.user.uid));

    if (!tag) {
      const likedTags = new Set();
      posts.forEach((p) => {
        if (p.likedByMe) p.tags.forEach((t) => likedTags.add(t));
      });
      if (likedTags.size > 0) {
        posts = posts
          .map((p, i) => ({ p, i, boost: p.tags.some((t) => likedTags.has(t)) ? 1 : 0 }))
          .sort((a, b) => b.boost - a.boost || a.i - b.i)
          .map((x) => x.p);
      }
      posts = posts.slice(0, 50);
    }

    res.json(posts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/posts/saved → posts the current user has bookmarked
router.get("/saved", verifyToken, async (req, res) => {
  try {
    const snap = await db
      .collection("posts")
      .where("savedBy", "array-contains", req.user.uid)
      .get();
    const posts = snap.docs
      .map((d) => serializePost(d, req.user.uid))
      .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
    res.json(posts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/posts → { text?, mediaBase64?, videoUrl? }
// Images use the base64-in-Firestore trick (no billing needed). Videos are
// uploaded client-side straight to Cloudinary first; this just stores the
// resulting URL.
router.post("/", verifyToken, async (req, res) => {
  try {
    const { text, mediaBase64, videoUrl } = req.body;
    if (!text && !mediaBase64 && !videoUrl) {
      return res.status(400).json({ error: "Post needs text, a photo, or a video" });
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
      videoUrl: videoUrl || null,
      tags: extractTags(text),
      likedBy: [],
      savedBy: [],
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

// POST /api/posts/:id/save → toggles bookmark on/off
router.post("/:id/save", verifyToken, async (req, res) => {
  try {
    const ref = db.collection("posts").doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: "Post not found" });

    const savedBy = doc.data().savedBy || [];
    const alreadySaved = savedBy.includes(req.user.uid);

    await ref.update({
      savedBy: alreadySaved
        ? admin.firestore.FieldValue.arrayRemove(req.user.uid)
        : admin.firestore.FieldValue.arrayUnion(req.user.uid),
    });

    res.json({ saved: !alreadySaved });
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
