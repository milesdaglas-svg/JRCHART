import { useState } from "react";

export default function GroupModal({ onClose, onCreate }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleCreate() {
    if (!name.trim()) return;
    setBusy(true);
    await onCreate(name.trim());
    setBusy(false);
    onClose();
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
      <div
        className="auth-card"
        style={{ width: 320 }}
        onClick={(e) => e.stopPropagation()}
      >
        <h1 style={{ fontSize: "1.2rem" }}>New group</h1>
        <div className="field">
          <label>Group name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
          <button className="btn-accent" disabled={busy} onClick={handleCreate}>
            {busy ? "Creating…" : "Create"}
          </button>
          <button className="btn-outline" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
