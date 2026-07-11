import { useState } from "react";

export default function AddMemberModal({ onClose, onAdd }) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function handleAdd() {
    if (!email.trim()) return;
    setBusy(true);
    setError("");
    try {
      await onAdd(email.trim());
      setDone(true);
      setEmail("");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(23,35,29,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 50,
      }}
      onClick={onClose}
    >
      <div className="auth-card" style={{ width: 320 }} onClick={(e) => e.stopPropagation()}>
        <h1 style={{ fontSize: "1.2rem" }}>Add to group</h1>
        <div className="field">
          <label>Their email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@example.com"
            autoFocus
          />
        </div>
        {error && <p className="error-text">{error}</p>}
        {done && <p style={{ color: "var(--accent)", fontSize: "0.85rem" }}>Added ✓</p>}
        <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
          <button className="btn-accent" disabled={busy} onClick={handleAdd}>
            {busy ? "Adding…" : "Add"}
          </button>
          <button className="btn-outline" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}
