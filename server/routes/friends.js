const express = require("express");
const { db, admin } = require("../firebaseAdmin");
const { verifyToken } = require("../middleware/verifyToken");

const router = express.Router();

// Finds an existing 1-to-1 DM group between two users, or creates one.
async function ensureDMGroup(uidA, uidB) {
  const snap = await db
    .collection("groups")
    .where("isDM", "==", true)
    .where("members", "array-contains", uidA)
    .get();

  const existing = snap.docs.find((d) => d.data().members.includes(uidB));
  if (existing) return existing.id;

  const ref = await db.collection("groups").add({
    name: null, // DMs don't have their own name — client shows the other person's name
    isDefault: false,
    isDM: true,
    adminOnlyPosting: false,
    members: [uidA, uidB],
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  return ref.id;
}

// GET /api/friends/users → everyone else on the app, with your relationship status to each
router.get("/users", verifyToken, async (req, res) => {
  try {
    const myUid = req.user.uid;
    const [usersSnap, myDoc, reqSnap] = await Promise.all([
      db.collection("users").get(),
      db.collection("users").doc(myUid).get(),
      db
        .collection("friendRequests")
        .where("status", "==", "pending")
        .get(),
    ]);

    const myFriends = new Set(myDoc.data()?.friends || []);
    const pendingSent = new Set(
      reqSnap.docs.filter((d) => d.data().fromUid === myUid).map((d) => d.data().toUid)
    );
    const pendingReceived = new Set(
      reqSnap.docs.filter((d) => d.data().toUid === myUid).map((d) => d.data().fromUid)
    );

    const users = usersSnap.docs
      .filter((d) => d.id !== myUid)
      .map((d) => {
        const data = d.data();
        let relationship = "none";
        if (myFriends.has(d.id)) relationship = "friends";
        else if (pendingSent.has(d.id)) relationship = "pending_sent";
        else if (pendingReceived.has(d.id)) relationship = "pending_received";
        return { id: d.id, displayName: data.displayName, email: data.email, relationship };
      });

    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/friends/requests → incoming pending requests, with sender info
router.get("/requests", verifyToken, async (req, res) => {
  try {
    const snap = await db
      .collection("friendRequests")
      .where("toUid", "==", req.user.uid)
      .where("status", "==", "pending")
      .get();

    const requests = await Promise.all(
      snap.docs.map(async (d) => {
        const data = d.data();
        const fromDoc = await db.collection("users").doc(data.fromUid).get();
        return { id: d.id, fromUid: data.fromUid, fromName: fromDoc.data()?.displayName || "Someone" };
      })
    );
    res.json(requests);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/friends → my accepted friends, each with their DM group id
router.get("/", verifyToken, async (req, res) => {
  try {
    const myDoc = await db.collection("users").doc(req.user.uid).get();
    const friendUids = myDoc.data()?.friends || [];

    const friends = await Promise.all(
      friendUids.map(async (uid) => {
        const doc = await db.collection("users").doc(uid).get();
        const groupId = await ensureDMGroup(req.user.uid, uid);
        return { id: uid, displayName: doc.data()?.displayName || "Unknown", groupId };
      })
    );
    res.json(friends);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/friends/request → { toUid }
router.post("/request", verifyToken, async (req, res) => {
  try {
    const { toUid } = req.body;
    if (!toUid || toUid === req.user.uid) {
      return res.status(400).json({ error: "Invalid target user" });
    }

    const existing = await db
      .collection("friendRequests")
      .where("fromUid", "==", req.user.uid)
      .where("toUid", "==", toUid)
      .where("status", "==", "pending")
      .get();
    if (!existing.empty) return res.json({ ok: true }); // already sent

    await db.collection("friendRequests").add({
      fromUid: req.user.uid,
      toUid,
      status: "pending",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    res.status(201).json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/friends/:id/accept
router.post("/:id/accept", verifyToken, async (req, res) => {
  try {
    const reqRef = db.collection("friendRequests").doc(req.params.id);
    const reqDoc = await reqRef.get();
    if (!reqDoc.exists) return res.status(404).json({ error: "Request not found" });

    const { fromUid, toUid } = reqDoc.data();
    if (toUid !== req.user.uid) return res.status(403).json({ error: "Not your request to accept" });

    await reqRef.update({ status: "accepted" });
    await db.collection("users").doc(fromUid).update({
      friends: admin.firestore.FieldValue.arrayUnion(toUid),
    });
    await db.collection("users").doc(toUid).update({
      friends: admin.firestore.FieldValue.arrayUnion(fromUid),
    });

    const groupId = await ensureDMGroup(fromUid, toUid);
    res.json({ ok: true, groupId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/friends/:id/decline
router.post("/:id/decline", verifyToken, async (req, res) => {
  try {
    const reqRef = db.collection("friendRequests").doc(req.params.id);
    const reqDoc = await reqRef.get();
    if (!reqDoc.exists) return res.status(404).json({ error: "Request not found" });
    if (reqDoc.data().toUid !== req.user.uid) {
      return res.status(403).json({ error: "Not your request to decline" });
    }
    await reqRef.update({ status: "declined" });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = { router, ensureDMGroup };
