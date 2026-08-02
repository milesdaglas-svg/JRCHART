export default function PostGridTile({ post, onOpen }) {
  const isVideo = post.mediaType === "video";
  const thumb = post.thumbnailUrl || (post.mediaType === "image" ? post.mediaBase64 : null);

  function formatDuration(sec) {
    if (!sec) return null;
    const m = Math.floor(sec / 60);
    const s = Math.round(sec % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  }

  return (
    <div
      onClick={() => onOpen(post)}
      style={{
        position: "relative",
        aspectRatio: "1 / 1",
        borderRadius: 10,
        overflow: "hidden",
        cursor: "pointer",
        background: "var(--bg-sidebar)",
      }}
    >
      {thumb ? (
        <img src={thumb} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
      ) : isVideo ? (
        // Videos posted before thumbnails existed won't have one yet —
        // fall back to a plain video-with-icon tile instead of breaking.
        <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#111" }}>
          <span style={{ fontSize: "1.6rem" }}>🎥</span>
        </div>
      ) : (
        <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", padding: 10, textAlign: "center" }}>
          <span style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>
            {post.text?.slice(0, 60) || ""}
          </span>
        </div>
      )}

      {isVideo && (
        <span style={{ position: "absolute", top: 6, right: 8, fontSize: "1rem", filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.6))" }}>
          ▶
        </span>
      )}

      {isVideo && post.durationSeconds && (
        <span
          style={{
            position: "absolute",
            bottom: 6,
            right: 8,
            fontSize: "0.68rem",
            color: "#fff",
            background: "rgba(0,0,0,0.55)",
            padding: "1px 5px",
            borderRadius: 4,
            fontFamily: "var(--font-mono)",
          }}
        >
          {formatDuration(post.durationSeconds)}
        </span>
      )}

      {post.likeCount > 0 && (
        <span
          style={{
            position: "absolute",
            bottom: 6,
            left: 8,
            fontSize: "0.68rem",
            color: "#fff",
            textShadow: "0 1px 2px rgba(0,0,0,0.6)",
          }}
        >
          ♥ {post.likeCount}
        </span>
      )}
    </div>
  );
}