export default function StoryViewerModal({ story, onClose }) {
  if (!story) return null;

  const postedAt = story.createdAt?._seconds
    ? new Date(story.createdAt._seconds * 1000)
    : new Date();

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(20, 39, 32, 0.92)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 60,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: 360,
          maxWidth: "90vw",
          background: "var(--ivory)",
          borderRadius: 14,
          overflow: "hidden",
          borderTop: "4px solid var(--accent)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {story.mediaUrl && (
          <img src={story.mediaUrl} alt="story" style={{ width: "100%", display: "block", maxHeight: 420, objectFit: "cover" }} />
        )}
        <div style={{ padding: 18 }}>
          {story.text && <p style={{ margin: 0, fontSize: "1.02rem" }}>{story.text}</p>}
          <p style={{ margin: "10px 0 0", fontSize: "0.75rem", color: "#5b6b62" }}>
            Posted {postedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · disappears in 24h
          </p>
        </div>
      </div>
    </div>
  );
}
