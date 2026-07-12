const express = require("express");
const { db, admin } = require("../firebaseAdmin");
const { verifyToken, requireAdmin } = require("../middleware/verifyToken");

const router = express.Router();
const DEFAULT_GROUP_ID = "announcements";

// Ensures the app-wide default "Announcements" group exists.
// Call this once on server boot (see index.js) and also defensively here.
async function ensureDefaultGroup() {
  const ref = db.collection("groups").doc(DEFAULT_GROUP_ID);
  const doc = await ref.get();
  if (!doc.exists) {
    await ref.set({
      name: "Announcements",
      isDefault: true,
      adminOnlyPosting: true,
      members: [],
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
}

// GET /api/groups  → groups the current user belongs to
router.get("/", verifyToken, async (req, res) => {
  try {
    const snap = await db
      .collection("groups")
      .where("members", "array-contains", req.user.uid)
      .get();

    const groups = await Promise.all(
      snap.docs.map(async (d) => {
        const data = { id: d.id, ...d.data() };
        if (data.isDM && !data.name) {
          const otherUid = (data.members || []).find((uid) => uid !== req.user.uid);
          if (otherUid) {
            const otherDoc = await db.collection("users").doc(otherUid).get();
            data.displayName = otherDoc.data()?.displayName || "Direct message";
          }
        }
        return data;
      })
    );

    res.json(groups);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/groups  → create a new group { name, memberIds: [] }
router.post("/", verifyToken, async (req, res) => {
  try {
    const { name, memberIds = [] } = req.body;
    if (!name) return res.status(400).json({ error: "Group name required" });

    const members = Array.from(new Set([req.user.uid, ...memberIds]));
    const ref = await db.collection("groups").add({
      name,
      isDefault: false,
      adminOnlyPosting: false,
      members,
      createdBy: req.user.uid,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    res.status(201).json({ id: ref.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/groups/:id/join-default  → called right after signup on the client
router.post("/join-default", verifyToken, async (req, res) => {
  try {
    await ensureDefaultGroup();
    await db
      .collection("groups")
      .doc(DEFAULT_GROUP_ID)
      .update({ members: admin.firestore.FieldValue.arrayUnion(req.user.uid) });
    res.json({ ok: true, groupId: DEFAULT_GROUP_ID });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/groups/:id/members  → { email } — add an existing user to this group.
// Only current members can add people (keeps randoms from joining your groups).
router.post("/:id/members", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email is required" });

    const groupRef = db.collection("groups").doc(id);
    const groupDoc = await groupRef.get();
    if (!groupDoc.exists) return res.status(404).json({ error: "Group not found" });

    const group = groupDoc.data();
    if (!group.members?.includes(req.user.uid)) {
      return res.status(403).json({ error: "You're not a member of this group" });
    }
    if (group.isDefault) {
      return res.status(400).json({ error: "Everyone joins Announcements automatically" });
    }

    let targetUser;
    try {
      targetUser = await admin.auth().getUserByEmail(email);
    } catch {
      return res.status(404).json({ error: "No user found with that email" });
    }

    await groupRef.update({
      members: admin.firestore.FieldValue.arrayUnion(targetUser.uid),
    });

    res.json({ ok: true, addedUid: targetUser.uid });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/groups/:id/messages → most recent 50 messages, oldest first
router.get("/:id/messages", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const groupDoc = await db.collection("groups").doc(id).get();
    if (!groupDoc.exists) return res.status(404).json({ error: "Group not found" });

    const group = groupDoc.data();
    if (!group.members?.includes(req.user.uid)) {
      return res.status(403).json({ error: "You're not a member of this group" });
    }

    const snap = await db
      .collection("groups")
      .doc(id)
      .collection("messages")
      .orderBy("createdAt", "desc")
      .limit(50)
      .get();

    const messages = snap.docs.map((d) => ({ id: d.id, ...d.data() })).reverse();
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/groups/:id/messages  → send a message (blocked for non-admins in default group)
router.post("/:id/messages", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: "Message text required" });

    const groupDoc = await db.collection("groups").doc(id).get();
    if (!groupDoc.exists) return res.status(404).json({ error: "Group not found" });

    const group = groupDoc.data();
    if (group.adminOnlyPosting && !req.user.isAdmin) {
      return res.status(403).json({ error: "Only the admin can post updates here" });
    }

    const msgRef = await db
      .collection("groups")
      .doc(id)
      .collection("messages")
      .add({
        senderId: req.user.uid,
        text,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

    res.status(201).json({ id: msgRef.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = { router, ensureDefaultGroup, DEFAULT_GROUP_ID };
