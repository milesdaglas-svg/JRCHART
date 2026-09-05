import { useEffect, useRef, useState } from "react";
import ForwardIcon from "./ForwardIcon.jsx";

const PHOTO_DURATION_MS = 5000;

export default function StoryViewerModal({ stories, startIndex, isMine, authedFetch, onClose, onReshare }) {
  const [index, setIndex] = useState(startIndex || 0);
  const [progress, setProgress] = useState(0); // 0–1 for the current segment
  const [paused, setPaused] = useState(false);
  const [viewersOpen, setViewersOpen] = useState(false);
  const [viewers, setViewers] = useState(null);

  const story = stories[index];
  const rafRef = useRef(null);
  const startedAtRef = useRef(0);
  const pausedAtRef = useRef(0);
  const videoRef = useRef(null);
  const viewedRef = useRef(new Set());

  function goTo(i) {
    if (i < 0) return onClose();
    if (i >= stories.length) return onClose();
    setIndex(i);
    setProgress(0);
    setViewersOpen(false);
  }

  // Record a view once per story, skipped entirely for your own stories.
  useEffect(() => {
    if (isMine || !story) return;
    if (viewedRef.current.has(story.id)) return;
    viewedRef.current.add(story.id);
    authedFetch(`/api/stories/${story.id}/view`, { method: "POST" }).catch(() => {});
  }, [story?.id, isMine]);

  // Auto-advance: photos run a fixed timer, videos advance on their own "ended" event.
  useEffect(() => {
    if (!story || story.videoUrl) return;
    if (paused || viewersOpen) return;

    startedAtRef.current = performance.now() - pausedAtRef.current;
    function tick(now) {
      const elapsed = now - startedAtRef.current;
      const pct = Math.min(1, elapsed / PHOTO_DURATION_MS);
      setProgress(pct);
      if (pct >= 1) {
        goTo(index + 1);
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, paused, viewersOpen]);

  function handleVideoTimeUpdate(e) {
    const el = e.currentTarget;
    if (el.duration) setProgress(el.currentTime / el.duration);
  }

  function openViewers() {
    setPaused(true);
    setViewersOpen(true);
    if (!viewers) {
      authedFetch(`/api/stories/${story.id}/views`)
        .then(setViewers)
        .catch(() => setViewers([]));
    }
  }

  function closeViewers() {
    setViewersOpen(false);
    setPaused(false);
  }

  if (!story) return null;

  const postedAt = story.createdAt?._seconds ? new Date(story.createdAt._seconds * 1000) : new Date();
  const isVideo = !!story.videoUrl;

  return (
    <div style={{ position: "fixed", inset: 0, background: "#000", zIndex: 200 }}>
      {/* Progress segments — one per story in this person's set */}
      <div style={{ position: "absolute", top: 10, left: 10, right: 10, display: "flex", gap: 4, zIndex: 5 }}>
        {stories.map((s, i) => (
          <div key={s.id} style={{ flex: 1, height: 3, borderRadius: 2, background: "rgba(255,255,255,0.3)", overflow: "hidden" }}>
            <div
              style={{
                height: "100%",
                background: "#fff",
                width: i < index ? "100%" : i === index ? `${progress * 100}%` : "0%",
                transition: i === index ? "none" : "width 0.15s linear",
              }}
            />
          </div>
        ))}
      </div>

      {/* Header */}
      <div style={{ position: "absolute", top: 22, left: 12, right: 12, display: "flex", alignItems: "center", gap: 10, zIndex: 5, color: "#fff" }}>
        <div className="avatar-badge" style={{ width: 34, height: 34, fontSize: "0.75rem" }}>
          {(story.authorName || "?").slice(0, 2).toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: "0.9rem", textShadow: "0 1px 3px rgba(0,0,0,0.6)" }}>{story.authorName}</div>
          <div style={{ fontSize: "0.72rem", opacity: 0.85, textShadow: "0 1px 3px rgba(0,0,0,0.6)" }}>
            {postedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </div>
        </div>
        <button
          onClick={() => onReshare(story)}
          style={{ background: "rgba(0,0,0,0.4)", border: "none", color: "#fff", width: 36, height: 36, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}
          title="Forward this status"
        >
          <ForwardIcon size={18} color="#fff" />
        </button>
        <button
          onClick={onClose}
          style={{ background: "rgba(0,0,0,0.4)", border: "none", color: "#fff", width: 36, height: 36, borderRadius: "50%", fontSize: "1.15rem" }}
          title="Close"
        >
          ✕
        </button>
      </div>

      {/* Tap zones for prev/next, either side of the media */}
      <div style={{ position: "absolute", inset: 0, display: "flex" }}>
        <div style={{ flex: 1 }} onClick={() => goTo(index - 1)} />
        <div style={{ flex: 1 }} onClick={() => goTo(index + 1)} />
      </div>

      {/* Media */}
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
        {isVideo ? (
          <video
            ref={videoRef}
            src={story.videoUrl}
            poster={story.thumbnailUrl || undefined}
            autoPlay
            playsInline
            onTimeUpdate={handleVideoTimeUpdate}
            onEnded={() => goTo(index + 1)}
            style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
          />
        ) : story.mediaBase64 ? (
          <img src={story.mediaBase64} alt="story" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
        ) : (
          <div style={{ padding: 40, color: "#fff", fontSize: "1.3rem", textAlign: "center" }}>{story.text}</div>
        )}
      </div>

      {/* Caption, if there's both media and text */}
      {story.text && (story.mediaBase64 || isVideo) && (
        <div style={{ position: "absolute", left: 16, right: 16, bottom: isMine ? 70 : 24, color: "#fff", textShadow: "0 1px 3px rgba(0,0,0,0.7)", zIndex: 5, pointerEvents: "none" }}>
          {story.text}
        </div>
      )}

      {/* View count — only for your own story */}
      {isMine && (
        <button
          onClick={openViewers}
          style={{
            position: "absolute",
            left: 16,
            bottom: 20,
            zIndex: 5,
            background: "rgba(0,0,0,0.45)",
            border: "none",
            color: "#fff",
            borderRadius: 20,
            padding: "8px 14px",
            fontSize: "0.82rem",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          👁 {viewers ? viewers.length : "…"} view{viewers?.length === 1 ? "" : "s"}
        </button>
      )}

      {/* Viewer list sheet */}
      {viewersOpen && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            maxHeight: "50%",
            background: "var(--bg-sidebar-2, #14161c)",
            borderTopLeftRadius: 18,
            borderTopRightRadius: 18,
            zIndex: 10,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 6px", cursor: "pointer" }} onClick={closeViewers}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: "var(--border)" }} />
          </div>
          <div style={{ textAlign: "center", fontWeight: 600, fontSize: "0.88rem", paddingBottom: 10, borderBottom: "1px solid var(--border)", color: "var(--text-primary)" }}>
            Viewed by {viewers ? viewers.length : "…"}
          </div>
          <div style={{ overflowY: "auto", padding: "8px 16px" }}>
            {viewers?.length === 0 && (
              <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem", textAlign: "center", marginTop: 16 }}>No views yet.</p>
            )}
            {viewers?.map((v) => (
              <div key={v.userId} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0" }}>
                <div className="avatar-badge" style={{ width: 32, height: 32, fontSize: "0.7rem" }}>
                  {(v.viewerName || "?").slice(0, 2).toUpperCase()}
                </div>
                <span style={{ color: "var(--text-primary)", fontSize: "0.88rem" }}>{v.viewerName}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
