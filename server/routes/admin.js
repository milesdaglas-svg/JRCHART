const express = require("express");
const { db } = require("../firebaseAdmin");
const { verifyToken, requireAdmin } = require("../middleware/verifyToken");

const router = express.Router();
const CONFIG_REF = () => db.collection("appConfig").doc("global");

// GET /api/admin/config → public-ish read (any logged-in user needs this
// to render the current theme), no admin requirement
router.get("/config", verifyToken, async (req, res) => {
  try {
    const doc = await CONFIG_REF().get();
    const data = doc.exists
      ? doc.data()
      : { themeColor: "#25D366", allowUserThemeOverride: false };
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/admin/config  (admin only) → { themeColor?, allowUserThemeOverride? }
router.put("/config", verifyToken, requireAdmin, async (req, res) => {
  try {
    const { themeColor, allowUserThemeOverride } = req.body;
    const update = {};
    if (typeof themeColor === "string") update.themeColor = themeColor;
    if (typeof allowUserThemeOverride === "boolean") {
      update.allowUserThemeOverride = allowUserThemeOverride;
    }
    await CONFIG_REF().set(update, { merge: true });
    res.json({ ok: true, ...update });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/admin/users/:uid/promote (admin only) → make another user an admin
router.put("/users/:uid/promote", verifyToken, requireAdmin, async (req, res) => {
  try {
    await db.collection("users").doc(req.params.uid).set(
      { isAdmin: true },
      { merge: true }
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = { router };
