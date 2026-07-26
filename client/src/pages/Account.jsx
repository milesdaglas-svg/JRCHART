import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Account() {
  const { profile, firebaseUser, loadProfile, authedFetch } = useAuth();
  const [nameInput, setNameInput] = useState(profile?.displayName || "");
  const [saved, setSaved] = useState(false);

  async function handleSaveName(e) {
    e.preventDefault();
    if (!nameInput.trim()) return;
    await authedFetch("/api/users/me/display-name", {
      method: "PUT",
      body: JSON.stringify({ displayName: nameInput.trim() }),
    });
    await loadProfile();
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="admin-panel">
      <Link to="/" className="link-text">← Back to chats</Link>
      <h1>Account</h1>

      <div style={{ display: "flex", alignItems: "center", gap: 14, margin: "20px 0 28px" }}>
        <div className="avatar-badge" style={{ width: 56, height: 56, fontSize: "1.1rem" }}>
          {profile?.displayName?.slice(0, 2).toUpperCase() || "U"}
        </div>
        <div>
          <div style={{ fontWeight: 600, fontSize: "1rem" }}>{profile?.displayName}</div>
          <div style={{ fontSize: "0.82rem", color: "var(--text-secondary)" }}>{firebaseUser?.email}</div>
          {profile?.isAdmin && (
            <span style={{ fontSize: "0.7rem", color: "var(--accent)", fontWeight: 600 }}>Admin</span>
          )}
        </div>
      </div>

      <h2 style={{ fontSize: "1.05rem" }}>Display name</h2>
      <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
        This is the name people see on your chats, posts, and stories.
      </p>
      <form onSubmit={handleSaveName} style={{ display: "flex", gap: 10, marginBottom: 28 }}>
        <input
          value={nameInput}
          onChange={(e) => setNameInput(e.target.value)}
          style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid var(--parchment-line)", flex: 1 }}
        />
        <button className="btn-accent" type="submit">{saved ? "Saved ✓" : "Save"}</button>
      </form>

      <h2 style={{ fontSize: "1.05rem" }}>Email</h2>
      <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
        {firebaseUser?.email} — managed through your sign-in, not editable here.
      </p>

      <div style={{ marginTop: 40, paddingTop: 20, borderTop: "1px solid var(--border)" }}>
        <Link to="/settings" className="link-text" style={{ fontSize: "0.8rem" }}>
          Go to Settings →
        </Link>
      </div>
    </div>
  );
}
