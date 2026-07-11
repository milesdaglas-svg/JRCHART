import { useState } from "react";

export default function StoryComposerModal({ onClose, onSubmit }) {
  const [text, setText] = useState("");
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);

  function handleFile(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  async function handlePost() {
    if (!text.trim() && !file) return;
    setBusy(true);
    try {
      await onSubmit({ text: text.trim(), file });
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(23,35,29,0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 50,
      }}
      onClick={onClose}
    >
      <div className="auth-card" style={{ width: 340 }} onClick={(e) => e.stopPropagation()}>
        <h1 style={{ fontSize: "1.2rem" }}>New story</h1>
        <p className="subtitle">Visible to everyone for 24 hours.</p>

        {preview && (
          <img
            src={preview}
            alt="preview"
            style={{ width: "100%", borderRadius: 8, marginBottom: 12, maxHeight: 220, objectFit: "cover" }}
          />
        )}

        <div className="field">
          <label>Caption {file ? "(optional)" : ""}</label>
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="What's on your mind?" />
        </div>

        <div className="field">
          <label>Photo (optional)</label>
          <input type="file" accept="image/*" onChange={handleFile} />
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
          <button className="btn-accent" disabled={busy} onClick={handlePost}>
            {busy ? "Posting…" : "Post story"}
          </button>
          <button className="btn-outline" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
