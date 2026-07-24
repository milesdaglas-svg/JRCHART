export default function ShareToChatModal({ groups, onClose, onShare }) {
  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}
      onClick={onClose}
    >
      <div className="auth-card" style={{ width: 320, maxHeight: "70vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
        <h1 style={{ fontSize: "1.15rem" }}>Share to…</h1>
        {groups.length === 0 && <p className="subtitle">No chats yet — add a friend first.</p>}
        {groups.map((g) => (
          <button
            key={g.id}
            onClick={() => onShare(g.id)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              width: "100%",
              padding: "10px 6px",
              background: "none",
              border: "none",
              borderBottom: "1px solid var(--border)",
              color: "var(--text-primary)",
              textAlign: "left",
            }}
          >
            <div className="avatar-badge" style={{ width: 36, height: 36, fontSize: "0.8rem" }}>
              {(g.displayName || g.name || "?").slice(0, 2).toUpperCase()}
            </div>
            {g.displayName || g.name}
          </button>
        ))}
        <button className="btn-outline" style={{ width: "100%", marginTop: 12 }} onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}
