const { auth, db } = require("../firebaseAdmin");

// Verifies the Firebase ID token sent as "Authorization: Bearer <token>"
// and attaches req.user = { uid, email, isAdmin }
async function verifyToken(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) return res.status(401).json({ error: "Missing auth token" });

  try {
    const decoded = await auth.verifyIdToken(token);
    const userDoc = await db.collection("users").doc(decoded.uid).get();
    const userData = userDoc.exists ? userDoc.data() : {};

    req.user = {
      uid: decoded.uid,
      email: decoded.email,
      isAdmin: !!userData.isAdmin,
    };
    next();
  } catch (err) {
    console.error("Token verification failed:", err.message);
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

// Use after verifyToken to lock a route to admins only
function requireAdmin(req, res, next) {
  if (!req.user?.isAdmin) return res.status(403).json({ error: "Admin only" });
  next();
}

module.exports = { verifyToken, requireAdmin };
