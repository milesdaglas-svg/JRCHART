const express = require("express");
const { db, admin } = require("../firebaseAdmin");

const router = express.Router();

// A completely separate admin layer from the per-user isAdmin flag —
// gated by a single shared password (ROOT_ADMIN_PASSWORD in .env), not a
// Firebase login. This is meant for you (the app owner) to reach from any
// device without needing your own account flagged as admin.
function requireRootPassword(req, res, next) {
  const provided = req.headers["x-root-password"];
  if (!process.env.ROOT_ADMIN_PASSWORD) {
    return res.status(500).json({ error: "ROOT_ADMIN_PASSWORD isn't set on the server" });
  }
  if (provided !== process.env.ROOT_ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Wrong password" });
  }
  next();
}

// POST /api/root/login → just validates the password so the client can
// show a friendly error before trying anything else.
router.post("/login", (req, res) => {
  const { password } = req.body;
  if (!process.env.ROOT_ADMIN_PASSWORD) {
    return res.status(500).json({ error: "ROOT_ADMIN_PASSWORD isn't set on the server" });
  }
  if (password !== process.env.ROOT_ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Wrong password" });
  }
  res.json({ ok: true });
});

router.use(requireRootPassword);

// GET /api/root/groups → every group in the app, with member counts
router.get("/groups", async (req, res) => {
  try {
    const snap = await db.collection("groups").get();
    const groups = snap.docs.map((d) => {
      const g = d.data();
      return {
        id: d.id,
        name: g.name || (g.isDM ? "Direct message" : "Unnamed"),
        isDefault: !!g.isDefault,
        isDM: !!g.isDM,
        memberCount: g.members?.length || 0,
      };
    });
    res.json(groups);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/root/groups/:id → deletes the group and all its messages
router.delete("/groups/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const messagesSnap = await db.collection("groups").doc(id).collection("messages").get();
    const batch = db.batch();
    messagesSnap.docs.forEach((d) => batch.delete(d.ref));
    batch.delete(db.collection("groups").doc(id));
    await batch.commit();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/root/groups/:id/members → { email } — force-add anyone to any group
router.post("/groups/:id/members", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email is required" });

    let targetUser;
    try {
      targetUser = await admin.auth().getUserByEmail(email);
    } catch {
      return res.status(404).json({ error: "No user found with that email" });
    }

    await db
      .collection("groups")
      .doc(req.params.id)
      .update({ members: admin.firestore.FieldValue.arrayUnion(targetUser.uid) });

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/root/groups/:id/message → { text, isWarning? } — post as "System"
// into any group. Used for both warnings and just sending a message anywhere.
router.post("/groups/:id/message", async (req, res) => {
  try {
    const { text, isWarning } = req.body;
    if (!text) return res.status(400).json({ error: "Message text required" });

    const msgRef = await db
      .collection("groups")
      .doc(req.params.id)
      .collection("messages")
      .add({
        senderId: "system",
        senderName: isWarning ? "⚠️ System warning" : "System",
        text,
        isSystem: true,
        isWarning: !!isWarning,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

    res.status(201).json({ id: msgRef.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/root/users → every user, for picking who to message/manage
router.get("/users", async (req, res) => {
  try {
    const snap = await db.collection("users").get();
    const users = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/root/dm → { toUid, text } — sends a direct message to anyone,
// creating a "System" DM thread with them if one doesn't exist yet.
router.post("/dm", async (req, res) => {
  try {
    const { toUid, text } = req.body;
    if (!toUid || !text) return res.status(400).json({ error: "toUid and text are required" });

    const existing = await db
      .collection("groups")
      .where("isSystemDM", "==", true)
      .where("members", "array-contains", toUid)
      .get();

    let groupId = existing.docs[0]?.id;
    if (!groupId) {
      const userDoc = await db.collection("users").doc(toUid).get();
      const ref = await db.collection("groups").add({
        name: "App Support",
        isDefault: false,
        isDM: true,
        isSystemDM: true,
        adminOnlyPosting: false,
        members: [toUid],
        memberNames: { [toUid]: userDoc.data()?.displayName || "Someone" },
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      groupId = ref.id;
    }

    await db.collection("groups").doc(groupId).collection("messages").add({
      senderId: "system",
      senderName: "App Support",
      text,
      isSystem: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.json({ ok: true, groupId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = { router };
