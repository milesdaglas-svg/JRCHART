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
        friends: [], // uids of accepted friends — only friends can DM each other
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

// GET /api/users → everyone else on the app, with your relationship status
// to each of them (none / request-sent / request-received / friends).
// This powers the "People" tab.
router.get("/", verifyToken, async (req, res) => {
  try {
    const [usersSnap, reqSnap] = await Promise.all([
      db.collection("users").get(),
      db
        .collection("friendRequests")
        .where("status", "==", "pending")
        .get(),
    ]);

    const me = req.user.uid;
    const myDoc = await db.collection("users").doc(me).get();
    const myFriends = myDoc.data()?.friends || [];

    const sentTo = new Set();
    const receivedFrom = new Map(); // uid -> requestId
    reqSnap.docs.forEach((d) => {
      const r = d.data();
      if (r.fromUid === me) sentTo.add(r.toUid);
      if (r.toUid === me) receivedFrom.set(r.fromUid, d.id);
    });

    const people = usersSnap.docs
      .filter((d) => d.id !== me)
      .map((d) => {
        const u = d.data();
        let status = "none";
        let requestId = null;
        if (myFriends.includes(d.id)) status = "friends";
        else if (sentTo.has(d.id)) status = "request-sent";
        else if (receivedFrom.has(d.id)) {
          status = "request-received";
          requestId = receivedFrom.get(d.id);
        }
        return { id: d.id, displayName: u.displayName, email: u.email, status, requestId };
      });

    res.json(people);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/users/:uid/friend-request → send a friend request to someone
router.post("/:uid/friend-request", verifyToken, async (req, res) => {
  try {
    const targetUid = req.params.uid;
    if (targetUid === req.user.uid) {
      return res.status(400).json({ error: "Can't friend yourself" });
    }

    const existing = await db
      .collection("friendRequests")
      .where("fromUid", "==", req.user.uid)
      .where("toUid", "==", targetUid)
      .where("status", "==", "pending")
      .get();
    if (!existing.empty) return res.json({ ok: true, alreadySent: true });

    const ref = await db.collection("friendRequests").add({
      fromUid: req.user.uid,
      toUid: targetUid,
      status: "pending",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    res.status(201).json({ id: ref.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/users/friend-requests/:id/accept → become friends + auto-create a DM
router.post("/friend-requests/:id/accept", verifyToken, async (req, res) => {
  try {
    const reqRef = db.collection("friendRequests").doc(req.params.id);
    const reqDoc = await reqRef.get();
    if (!reqDoc.exists) return res.status(404).json({ error: "Request not found" });

    const request = reqDoc.data();
    if (request.toUid !== req.user.uid) {
      return res.status(403).json({ error: "This request isn't yours to accept" });
    }

    await reqRef.update({ status: "accepted" });

    await db.collection("users").doc(request.fromUid).update({
      friends: admin.firestore.FieldValue.arrayUnion(request.toUid),
    });
    await db.collection("users").doc(request.toUid).update({
      friends: admin.firestore.FieldValue.arrayUnion(request.fromUid),
    });

    // Auto-create their private DM if one doesn't already exist
    const dmSnap = await db
      .collection("groups")
      .where("isDM", "==", true)
      .where("members", "array-contains", request.fromUid)
      .get();
    const existingDM = dmSnap.docs.find((d) =>
      d.data().members.includes(request.toUid)
    );

    let dmId = existingDM?.id;
    if (!dmId) {
      const [fromDoc, toDoc] = await Promise.all([
        db.collection("users").doc(request.fromUid).get(),
        db.collection("users").doc(request.toUid).get(),
      ]);
      const dmRef = await db.collection("groups").add({
        name: null, // client displays the other person's name instead
        isDefault: false,
        isDM: true,
        adminOnlyPosting: false,
        members: [request.fromUid, request.toUid],
        memberNames: {
          [request.fromUid]: fromDoc.data()?.displayName || "Someone",
          [request.toUid]: toDoc.data()?.displayName || "Someone",
        },
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      dmId = dmRef.id;
    }

    res.json({ ok: true, dmId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/users/friend-requests/:id/decline
router.post("/friend-requests/:id/decline", verifyToken, async (req, res) => {
  try {
    const reqRef = db.collection("friendRequests").doc(req.params.id);
    const reqDoc = await reqRef.get();
    if (!reqDoc.exists) return res.status(404).json({ error: "Request not found" });
    if (reqDoc.data().toUid !== req.user.uid) {
      return res.status(403).json({ error: "This request isn't yours to decline" });
    }
    await reqRef.update({ status: "declined" });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = { router };
