import { useEffect, useRef, useState } from "react";
import VideoEmbed from "./VideoEmbed.jsx";

// TikTok-style comment sheet: slides up from the bottom of the slide,
// leaves the top of the video visible and still playing behind it.
function CommentSheet({ post, authedFetch, commentCount, onCountChange, open, onClose }) {
  const [comments, setComments] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [text, setText] = useState("");

  useEffect(() => {
    if (open && !loaded) {
      authedFetch(`/api/posts/${post.id}/comments`)
        .then((c) => setComments(c || []))
        .catch(() => {})
        .finally(() => setLoaded(true));
    }
  }, [open]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!text.trim()) return;
    const t = text.trim();
    setText("");
    await authedFetch(`/api/posts/${post.id}/comments`, {
      method: "POST",
      body: JSON.stringify({ text: t }),
    }).catch(() => {});
    setComments((prev) => [...prev, { text: t, authorName: "You" }]);
    onCountChange((c) => c + 1);
  }

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        height: "52%",
        background: "var(--bg-sidebar-2, #14161c)",
        borderTopLeftRadius: 18,
        borderTopRightRadius: 18,
        display: "flex",
        flexDirection: "column",
        boxShadow: "0 -8px 28px rgba(0,0,0,0.45)",
        transform: open ? "translateY(0)" : "translateY(100%)",
        transition: "transform 0.32s cubic-bezier(0.22, 1, 0.36, 1)",
        zIndex: 5,
      }}
    >
      <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 6px", cursor: "pointer" }} onClick={onClose}>
        <div style={{ width: 36, height: 4, borderRadius: 2, background: "var(--border)" }} />
      </div>
      <div
        style={{
          textAlign: "center",
          fontWeight: 600,
          fontSize: "0.88rem",
          paddingBottom: 10,
          borderBottom: "1px solid var(--border)",
          color: "var(--text-primary)",
        }}
      >
        {commentCount} comment{commentCount !== 1 ? "s" : ""}
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "10px 16px", WebkitOverflowScrolling: "touch" }}>
        {comments.map((c, i) => (
          <div key={c.id || i} style={{ fontSize: "0.86rem", marginBottom: 12, color: "var(--text-primary)" }}>
            <b>{c.authorName}</b> {c.text}
          </div>
        ))}
        {loaded && comments.length === 0 && (
          <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem", textAlign: "center", marginTop: 20 }}>
            No comments yet — say something.
          </p>
        )}
      </div>
      <form onSubmit={handleSubmit} style={{ display: "flex", gap: 8, padding: "10px 16px", borderTop: "1px solid var(--border)" }}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Add a comment…"
          style={{ flex: 1, padding: "10px 14px", borderRadius: 20, fontSize: "0.85rem" }}
        />
        <button className="pill-btn accent" type="submit">Post</button>
      </form>
    </div>
  );
}

function ReelSlide({ post, isActive, muted, onTap, liked, likeCount, saved, commentCount, onLike, onSave, onOpenComments, onTagClick }) {
  const videoRef = useRef(null);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (isActive) {
      const p = v.play();
      if (p && p.catch) p.catch(() => {});
    } else {
      v.pause();
    }
  }, [isActive]);

  return (
    <div
      onClick={onTap}
      style={{
        position: "relative",
        height: "100%",
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#000",
      }}
    >
      {post.mediaType === "video" && post.videoUrl && (
        <video
          ref={videoRef}
          src={post.videoUrl}
          muted={muted}
          loop
          playsInline
          style={{ width: "100%", height: "100%", objectFit: "contain", background: "#000" }}
        />
      )}

      {post.mediaType === "embed" && (
        <div style={{ width: "100%" }} onClick={(e) => e.stopPropagation()}>
          <VideoEmbed platform={post.embedPlatform} embedId={post.embedId} embedHtml={post.embedHtml} />
        </div>
      )}

      {post.mediaType === "video" && (
        <span
          style={{
            position: "absolute",
            top: 16,
            right: 16,
            fontSize: "1.05rem",
            color: "#fff",
            background: "rgba(0,0,0,0.4)",
            borderRadius: "50%",
            width: 34,
            height: 34,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {muted ? "🔇" : "🔊"}
        </span>
      )}

      {/* Caption, bottom-left */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ position: "absolute", left: 16, right: 84, bottom: 28, color: "#fff" }}
      >
        <div style={{ fontWeight: 600, marginBottom: 6, textShadow: "0 1px 3px rgba(0,0,0,0.7)" }}>{post.authorName}</div>
        {post.text && (
          <div style={{ fontSize: "0.88rem", textShadow: "0 1px 3px rgba(0,0,0,0.7)" }}>
            {post.text.split(/(\s+)/).map((word, i) =>
              word.startsWith("#") ? (
                <span key={i} onClick={() => onTagClick?.(word.replace("#", ""))} style={{ color: "#8fb8ff", cursor: "pointer" }}>
                  {word}
                </span>
              ) : (
                word
              )
            )}
          </div>
        )}
      </div>

      {/* Instagram-style icon rail, bottom-right */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ position: "absolute", right: 12, bottom: 28, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}
      >
        <button onClick={onLike} style={{ background: "none", border: "none", color: liked ? "var(--danger)" : "#fff", fontSize: "1.9rem", textShadow: "0 1px 3px rgba(0,0,0,0.6)" }}>
          {liked ? "♥" : "♡"}
        </button>
        <span style={{ color: "#fff", fontSize: "0.72rem", marginBottom: 14, textShadow: "0 1px 3px rgba(0,0,0,0.6)" }}>{likeCount}</span>

        <button onClick={onOpenComments} style={{ background: "none", border: "none", color: "#fff", fontSize: "1.75rem", textShadow: "0 1px 3px rgba(0,0,0,0.6)" }}>
          💬
        </button>
        <span style={{ color: "#fff", fontSize: "0.72rem", marginBottom: 14, textShadow: "0 1px 3px rgba(0,0,0,0.6)" }}>{commentCount}</span>

        <button onClick={onSave} style={{ background: "none", border: "none", color: saved ? "var(--accent)" : "#fff", fontSize: "1.65rem", textShadow: "0 1px 3px rgba(0,0,0,0.6)" }}>
          {saved ? "🔖" : "📑"}
        </button>
      </div>
    </div>
  );
}

export default function ReelsViewer({ posts, startIndex, authedFetch, onClose, onTagClick }) {
  const [activeIndex, setActiveIndex] = useState(startIndex);
  const [muted, setMuted] = useState(true);
  const [commentsOpenFor, setCommentsOpenFor] = useState(null);
  const [state, setState] = useState(() => {
    const m = {};
    posts.forEach((p) => {
      m[p.id] = { liked: p.likedByMe, likeCount: p.likeCount || 0, saved: p.savedByMe, commentCount: p.commentCount || 0 };
    });
    return m;
  });

  const containerRef = useRef(null);
  const slideRefs = useRef([]);

  // Jump straight to the video that was tapped, no animation.
  useEffect(() => {
    const el = slideRefs.current[startIndex];
    if (el) el.scrollIntoView({ block: "start" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Whichever slide is >60% visible becomes "active" (autoplays); others pause.
  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio > 0.6) {
            setActiveIndex(Number(entry.target.dataset.idx));
          }
        });
      },
      { root, threshold: [0.6] }
    );
    slideRefs.current.forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, [posts.length]);

  function update(postId, patch) {
    setState((prev) => ({
      ...prev,
      [postId]: { ...prev[postId], ...(typeof patch === "function" ? patch(prev[postId]) : patch) },
    }));
  }

  async function handleLike(post) {
    const cur = state[post.id];
    update(post.id, { liked: !cur.liked, likeCount: cur.liked ? cur.likeCount - 1 : cur.likeCount + 1 });
    await authedFetch(`/api/posts/${post.id}/like`, { method: "POST" }).catch(() => {});
  }

  async function handleSave(post) {
    const cur = state[post.id];
    update(post.id, { saved: !cur.saved });
    await authedFetch(`/api/posts/${post.id}/save`, { method: "POST" }).catch(() => {});
  }

  function handleTap(postId) {
    // Tapping the video while comments are open closes them first;
    // otherwise it toggles mute, same as TikTok.
    if (commentsOpenFor === postId) {
      setCommentsOpenFor(null);
    } else {
      setMuted((m) => !m);
    }
  }

  return (
    <div style={{ position: "fixed", inset: 0, height: "100dvh", zIndex: 100, background: "#000" }}>
      <button
        onClick={onClose}
        style={{
          position: "absolute",
          top: 16,
          left: 16,
          zIndex: 10,
          background: "rgba(0,0,0,0.45)",
          border: "none",
          color: "#fff",
          fontSize: "1.3rem",
          width: 38,
          height: 38,
          borderRadius: "50%",
          cursor: "pointer",
        }}
      >
        ✕
      </button>

      <div ref={containerRef} className="reels-scroll" style={{ height: "100%", width: "100%", overflowY: "auto", scrollSnapType: "y mandatory" }}>
        {posts.map((post, i) => (
          <div
            key={post.id}
            data-idx={i}
            ref={(el) => (slideRefs.current[i] = el)}
            style={{ position: "relative", height: "100%", width: "100%", scrollSnapAlign: "start", scrollSnapStop: "always" }}
          >
            <ReelSlide
              post={post}
              isActive={activeIndex === i}
              muted={muted}
              onTap={() => handleTap(post.id)}
              liked={state[post.id]?.liked}
              likeCount={state[post.id]?.likeCount || 0}
              saved={state[post.id]?.saved}
              commentCount={state[post.id]?.commentCount || 0}
              onLike={() => handleLike(post)}
              onSave={() => handleSave(post)}
              onOpenComments={() => setCommentsOpenFor(post.id)}
              onTagClick={onTagClick}
            />
            <CommentSheet
              post={post}
              authedFetch={authedFetch}
              commentCount={state[post.id]?.commentCount || 0}
              onCountChange={(fn) => update(post.id, (cur) => ({ commentCount: fn(cur.commentCount) }))}
              open={commentsOpenFor === post.id}
              onClose={() => setCommentsOpenFor(null)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
