export default function MessageBubble({ message, isMine, onDelete }) {
  const time = message.createdAt
    ? new Date(
        message.createdAt._seconds ? message.createdAt._seconds * 1000 : message.createdAt
      ).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "";

  if (message.isWarning) {
    return (
      <div className="bubble warning">
        <div>⚠️ {message.text}</div>
        <div className="bubble-meta">{time}</div>
      </div>
    );
  }

  return (
    <div className={`bubble ${isMine ? "mine" : "theirs"}`} style={{ position: "relative" }}>
      {message.isSystem && !isMine && (
        <div style={{ fontSize: "0.72rem", fontWeight: 700, opacity: 0.7, marginBottom: 2 }}>
          {message.senderName || "System"}
        </div>
      )}

      {message.sharedPost && (
        <div style={{ background: "rgba(0,0,0,0.15)", borderRadius: 8, overflow: "hidden", marginBottom: 6, maxWidth: 220 }}>
          {message.sharedPost.mediaBase64 && (
            <img src={message.sharedPost.mediaBase64} alt="shared post" style={{ width: "100%", display: "block", maxHeight: 160, objectFit: "cover" }} />
          )}
          {message.sharedPost.videoUrl && (
            <video src={message.sharedPost.videoUrl} style={{ width: "100%", display: "block", maxHeight: 160 }} muted />
          )}
          <div style={{ padding: "6px 8px", fontSize: "0.78rem" }}>
            <b>{message.sharedPost.authorName}</b>
            {message.sharedPost.text && <div style={{ opacity: 0.85 }}>{message.sharedPost.text}</div>}
          </div>
        </div>
      )}

      {message.text && <div>{message.text}</div>}
      <div className="bubble-meta">{time}</div>

      {isMine && onDelete && (
        <button
          onClick={onDelete}
          title="Delete message"
          style={{
            position: "absolute",
            top: -8,
            right: -8,
            width: 20,
            height: 20,
            borderRadius: "50%",
            border: "none",
            background: "var(--bg-surface-2)",
            color: "var(--text-secondary)",
            fontSize: "0.7rem",
            lineHeight: 1,
            opacity: 0,
            transition: "opacity 0.15s ease",
          }}
          className="msg-delete-btn"
        >
          ✕
        </button>
      )}
    </div>
  );
}
