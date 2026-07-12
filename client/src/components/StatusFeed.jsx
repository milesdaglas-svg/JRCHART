export default function StatusFeed({ stories, myId, onAddStory, onView, myStoryPosted }) {
  const others = stories.filter((s) => s.userId !== myId);
  const mine = stories.filter((s) => s.userId === myId);

  return (
    <div className="scroll-panel">
      <div className="status-feed-item" onClick={onAddStory} style={{ cursor: "pointer" }}>
        <div
          className="status-thumb"
          style={
            mine[0]?.mediaBase64
              ? { backgroundImage: `url(${mine[0].mediaBase64})` }
              : { borderStyle: "dashed" }
          }
        >
          {!mine[0]?.mediaBase64 && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", fontSize: "1.4rem" }}>
              {myStoryPosted ? "✓" : "+"}
            </div>
          )}
        </div>
        <div>
          <div className="person-name">Your status</div>
          <div className="person-sub">{myStoryPosted ? "Tap to add another" : "Tap to add a status update"}</div>
        </div>
      </div>

      <div className="list-section-label">Recent updates</div>
      {others.map((s) => (
        <div key={s.id} className="status-feed-item" style={{ cursor: "pointer" }} onClick={() => onView(s)}>
          <div
            className="status-thumb"
            style={s.mediaBase64 ? { backgroundImage: `url(${s.mediaBase64})` } : undefined}
          >
            {!s.mediaBase64 && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-primary)", fontWeight: 600 }}>
                {(s.userId || "?").slice(0, 2).toUpperCase()}
              </div>
            )}
          </div>
          <div>
            <div className="person-name">{s.text ? s.text.slice(0, 40) : "Photo update"}</div>
            <div className="person-sub">Tap to view · disappears in 24h</div>
          </div>
        </div>
      ))}
      {others.length === 0 && (
        <p style={{ padding: 16, color: "var(--text-secondary)", fontSize: "0.85rem" }}>
          No updates from anyone right now.
        </p>
      )}
    </div>
  );
}
