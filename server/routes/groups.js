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

// GET /api/groups/discover → public groups you're not in yet
router.get("/discover", verifyToken, async (req, res) => {
  try {
    const snap = await db.collection("groups").get();
    const reqSnap = await db
      .collection("groupJoinRequests")
      .where("uid", "==", req.user.uid)
      .where("status", "==", "pending")
      .get();
    const pendingGroupIds = new Set(reqSnap.docs.map((d) => d.data().groupId));

    const groups = snap.docs
      .filter((d) => {
        const data = d.data();
        return !data.isDM && !data.isDefault && !(data.members || []).includes(req.user.uid);
      })
      .map((d) => {
        const data = d.data();
        return {
          id: d.id,
          name: data.name,
          memberCount: (data.members || []).length,
          requested: pendingGroupIds.has(d.id),
        };
      });

    res.json(groups);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/groups/:id/request-join → send a join request to the group's creator
router.post("/:id/request-join", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const groupDoc = await db.collection("groups").doc(id).get();
    if (!groupDoc.exists) return res.status(404).json({ error: "Group not found" });

    const group = groupDoc.data();
    if ((group.members || []).includes(req.user.uid)) {
      return res.status(400).json({ error: "You're already in this group" });
    }

    const existing = await db
      .collection("groupJoinRequests")
      .where("groupId", "==", id)
      .where("uid", "==", req.user.uid)
      .where("status", "==", "pending")
      .get();
    if (!existing.empty) return res.json({ ok: true });

    await db.collection("groupJoinRequests").add({
      groupId: id,
      uid: req.user.uid,
      status: "pending",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    res.status(201).json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/groups/join-requests → pending requests for groups YOU created
router.get("/join-requests", verifyToken, async (req, res) => {
  try {
    const ownedSnap = await db
      .collection("groups")
      .where("createdBy", "==", req.user.uid)
      .get();
    const ownedIds = ownedSnap.docs.map((d) => d.id);
    if (ownedIds.length === 0) return res.json([]);

    const reqSnap = await db
      .collection("groupJoinRequests")
      .where("groupId", "in", ownedIds.slice(0, 10))
      .where("status", "==", "pending")
      .get();

    const requests = await Promise.all(
      reqSnap.docs.map(async (d) => {
        const data = d.data();
        const userDoc = await db.collection("users").doc(data.uid).get();
        const groupDoc = ownedSnap.docs.find((g) => g.id === data.groupId);
        return {
          id: d.id,
          groupId: data.groupId,
          groupName: groupDoc?.data()?.name,
          uid: data.uid,
          displayName: userDoc.data()?.displayName || "Someone",
        };
      })
    );
    res.json(requests);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/groups/join-requests/:reqId/approve
router.post("/join-requests/:reqId/approve", verifyToken, async (req, res) => {
  try {
    const reqRef = db.collection("groupJoinRequests").doc(req.params.reqId);
    const reqDoc = await reqRef.get();
    if (!reqDoc.exists) return res.status(404).json({ error: "Request not found" });

    const { groupId, uid } = reqDoc.data();
    const groupRef = db.collection("groups").doc(groupId);
    const groupDoc = await groupRef.get();
    if (!groupDoc.exists || groupDoc.data().createdBy !== req.user.uid) {
      return res.status(403).json({ error: "Only that group's creator can approve requests" });
    }

    await reqRef.update({ status: "approved" });
    await groupRef.update({ members: admin.firestore.FieldValue.arrayUnion(uid) });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/groups/join-requests/:reqId/decline
router.post("/join-requests/:reqId/decline", verifyToken, async (req, res) => {
  try {
    const reqRef = db.collection("groupJoinRequests").doc(req.params.reqId);
    const reqDoc = await reqRef.get();
    if (!reqDoc.exists) return res.status(404).json({ error: "Request not found" });

    const { groupId } = reqDoc.data();
    const groupDoc = await db.collection("groups").doc(groupId).get();
    if (!groupDoc.exists || groupDoc.data().createdBy !== req.user.uid) {
      return res.status(403).json({ error: "Only that group's creator can decline requests" });
    }

    await reqRef.update({ status: "declined" });
    res.json({ ok: true });
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
    const { text, sharedPost, audioUrl, audioDuration } = req.body;
    if (!text && !sharedPost && !audioUrl) return res.status(400).json({ error: "Message text required" });

    const groupDoc = await db.collection("groups").doc(id).get();
    if (!groupDoc.exists) return res.status(404).json({ error: "Group not found" });

    const group = groupDoc.data();
    if (group.adminOnlyPosting && !req.user.isAdmin) {
      return res.status(403).json({ error: "Only the admin can post updates here" });
    }

    const payload = {
      senderId: req.user.uid,
      text: text || "",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    if (sharedPost) payload.sharedPost = sharedPost;
    if (audioUrl) {
      payload.audioUrl = audioUrl;
      payload.audioDuration = audioDuration || 0;
    }

    const msgRef = await db.collection("groups").doc(id).collection("messages").add(payload);

    res.status(201).json({ id: msgRef.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/groups/:id/messages/:messageId → only your own message
router.delete("/:id/messages/:messageId", verifyToken, async (req, res) => {
  try {
    const { id, messageId } = req.params;
    const msgRef = db.collection("groups").doc(id).collection("messages").doc(messageId);
    const msgDoc = await msgRef.get();
    if (!msgDoc.exists) return res.status(404).json({ error: "Message not found" });
    if (msgDoc.data().senderId !== req.user.uid) {
      return res.status(403).json({ error: "You can only delete your own messages" });
    }
    await msgRef.delete();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = { router, ensureDefaultGroup, DEFAULT_GROUP_ID };