import { useEffect, useRef, useState } from "react";
import VideoEmbed from "./VideoEmbed.jsx";
import ForwardIcon from "./ForwardIcon.jsx";
import ShareToChatModal from "./ShareToChatModal.jsx";

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
        position: "fixed",
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
        zIndex: 150,
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

function ReelSlide({ post, isActive, muted, onTap, onDoubleTap, showHeartBurst, liked, likeCount, saved, commentCount, onLike, onSave, onShare, onOpenComments, onTagClick, isWideScreen }) {
  const videoRef = useRef(null);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    // Same fix as the in-feed preview: force `muted` onto the real DOM
    // element, since React doesn't reliably apply it from the JSX prop,
    // which otherwise silently blocks autoplay and leaves a black frame.
    v.muted = muted;
    if (isActive) {
      const p = v.play();
      if (p && p.catch) p.catch(() => {});
    } else {
      v.pause();
    }
  }, [isActive, muted]);

  return (
    <div
      onClick={onTap}
      onDoubleClick={onDoubleTap}
      style={{
        position: "relative",
        height: "100%",
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#000",
        overflow: "hidden",
      }}
    >
      {post.mediaType === "video" && post.videoUrl && (
        <video
          ref={videoRef}
          src={post.videoUrl}
          poster={post.thumbnailUrl || undefined}
          loop
          playsInline
          preload="metadata"
          style={
            isWideScreen
              ? { maxWidth: 480, width: "100%", height: "100%", objectFit: "contain", background: "#000", margin: "0 auto", boxShadow: "0 0 60px rgba(0,0,0,0.6)" }
              : { width: "100%", height: "100%", objectFit: "cover", background: "#000" }
          }
        />
      )}

      {post.mediaType === "embed" && (
        <div style={{ width: "100%" }} onClick={(e) => e.stopPropagation()}>
          <VideoEmbed platform={post.embedPlatform} embedId={post.embedId} embedHtml={post.embedHtml} />
        </div>
      )}

      {showHeartBurst && (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
          <span
            style={{
              fontSize: "6rem",
              color: "#fff",
              filter: "drop-shadow(0 2px 10px rgba(0,0,0,0.5))",
              animation: "reel-heart-burst 0.7s ease forwards",
            }}
          >
            ♥
          </span>
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
        <div style={{ fontWeight: 600, marginBottom: 6, fontSize: "0.92rem", textShadow: "0 1px 3px rgba(0,0,0,0.7)" }}>{post.authorName}</div>
        {post.text && (
          <div style={{ fontSize: "0.85rem", textShadow: "0 1px 3px rgba(0,0,0,0.7)" }}>
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
        <button onClick={onLike} style={{ background: "none", border: "none", color: liked ? "var(--danger)" : "#fff", fontSize: "1.85rem", textShadow: "0 1px 3px rgba(0,0,0,0.6)" }}>
          {liked ? "♥" : "♡"}
        </button>
        <span style={{ color: "#fff", fontSize: "0.7rem", marginBottom: 12, textShadow: "0 1px 3px rgba(0,0,0,0.6)" }}>{likeCount}</span>

        <button onClick={onOpenComments} style={{ background: "none", border: "none", color: "#fff", fontSize: "1.7rem", textShadow: "0 1px 3px rgba(0,0,0,0.6)" }}>
          💬
        </button>
        <span style={{ color: "#fff", fontSize: "0.7rem", marginBottom: 12, textShadow: "0 1px 3px rgba(0,0,0,0.6)" }}>{commentCount}</span>

        <button onClick={onShare} style={{ background: "none", border: "none", color: "#fff", display: "flex", filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.6))" }}>
          <ForwardIcon size={26} color="#fff" />
        </button>
        <span style={{ marginBottom: 12 }} />

        <button onClick={onSave} style={{ background: "none", border: "none", color: saved ? "var(--accent)" : "#fff", fontSize: "1.6rem", textShadow: "0 1px 3px rgba(0,0,0,0.6)" }}>
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
  const [shareFor, setShareFor] = useState(null);
  const [shareGroups, setShareGroups] = useState([]);
  const [burstFor, setBurstFor] = useState(null);
  const [state, setState] = useState(() => {
    const m = {};
    posts.forEach((p) => {
      m[p.id] = { liked: p.likedByMe, likeCount: p.likeCount || 0, saved: p.savedByMe, commentCount: p.commentCount || 0 };
    });
    return m;
  });

  const containerRef = useRef(null);
  const trackRef = useRef(null);
  const [viewportHeight, setViewportHeight] = useState(() => window.innerHeight);
  const [isWideScreen, setIsWideScreen] = useState(() => window.innerWidth > 700);
  const dragState = useRef({ startY: 0, dragging: false, dragOffset: 0 });
  const [dragOffset, setDragOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const wheelLock = useRef(false);

  // Mobile browsers resize the viewport as the URL bar hides/shows —
  // recompute the page height so paging stays exact. Also tracks whether
  // we're on a wide (desktop) screen, where the video shouldn't crop to
  // fill edge-to-edge like it does on a phone.
  useEffect(() => {
    function onResize() {
      setViewportHeight(window.innerHeight);
      setIsWideScreen(window.innerWidth > 700);
    }
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, []);

  function goTo(index) {
    setActiveIndex(Math.max(0, Math.min(posts.length - 1, index)));
  }

  // Swipe up/down = one full page, like TikTok — no partial/free scroll.
  function handleTouchStart(e) {
    dragState.current = { startY: e.touches[0].clientY, dragging: true, dragOffset: 0 };
    setDragging(true);
  }

  function handleTouchMove(e) {
    if (!dragState.current.dragging) return;
    // Block the browser's native pull-to-refresh / rubber-band bounce —
    // without this, swiping down to reach the previous video gets eaten
    // by Chrome's own overscroll gesture instead of reaching our handler.
    e.preventDefault();
    let delta = e.touches[0].clientY - dragState.current.startY;
    // Resist dragging past the first/last video instead of allowing it to float free.
    if ((activeIndex === 0 && delta > 0) || (activeIndex === posts.length - 1 && delta < 0)) {
      delta *= 0.35;
    }
    dragState.current.dragOffset = delta;
    setDragOffset(delta);
  }

  function handleTouchEnd() {
    const { dragOffset: delta } = dragState.current;
    dragState.current.dragging = false;
    setDragging(false);
    setDragOffset(0);
    const threshold = viewportHeight * 0.18;
    if (delta <= -threshold) goTo(activeIndex + 1);
    else if (delta >= threshold) goTo(activeIndex - 1);
    // otherwise snaps back to the same page
  }

  // Mouse wheel support for desktop testing — one page per gesture.
  function handleWheel(e) {
    e.preventDefault();
    if (wheelLock.current) return;
    if (Math.abs(e.deltaY) < 12) return;
    wheelLock.current = true;
    goTo(activeIndex + (e.deltaY > 0 ? 1 : -1));
    setTimeout(() => (wheelLock.current = false), 500);
  }

  // Attached as real (non-passive) listeners so preventDefault() above
  // actually takes effect — React's JSX onTouchMove/onWheel are passive
  // by default and silently ignore preventDefault(), which is what let
  // the browser's own scroll/refresh gesture win over ours.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener("touchstart", handleTouchStart, { passive: false });
    el.addEventListener("touchmove", handleTouchMove, { passive: false });
    el.addEventListener("touchend", handleTouchEnd, { passive: false });
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      el.removeEventListener("touchstart", handleTouchStart);
      el.removeEventListener("touchmove", handleTouchMove);
      el.removeEventListener("touchend", handleTouchEnd);
      el.removeEventListener("wheel", handleWheel);
    };
  });

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

  async function openShare(post) {
    const g = await authedFetch("/api/groups").catch(() => []);
    setShareGroups(g || []);
    setShareFor(post);
  }

  async function handleShareTo(groupId) {
    const post = shareFor;
    setShareFor(null);
    if (!post) return;
    await authedFetch(`/api/groups/${groupId}/messages`, {
      method: "POST",
      body: JSON.stringify({
        text: "",
        sharedPost: {
          postId: post.id,
          authorName: post.authorName,
          text: post.text,
          mediaBase64: post.mediaBase64,
          videoUrl: post.videoUrl,
        },
      }),
    }).catch((err) => alert(err.message));
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

  // Double-tap anywhere on the video likes it and pops a heart, same as
  // Instagram/TikTok. Only fires a like (never un-likes) on double-tap.
  function handleDoubleTap(post) {
    const cur = state[post.id];
    if (!cur.liked) handleLike(post);
    setBurstFor(post.id);
    setTimeout(() => setBurstFor((f) => (f === post.id ? null : f)), 700);
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

      <div
        ref={containerRef}
        style={{ height: "100%", width: "100%", overflow: "hidden", overscrollBehavior: "none", touchAction: "none" }}
      >
        <div
          ref={trackRef}
          style={{
            height: viewportHeight * posts.length,
            transform: `translateY(${-activeIndex * viewportHeight + dragOffset}px)`,
            transition: dragging ? "none" : "transform 0.32s cubic-bezier(0.22, 1, 0.36, 1)",
          }}
        >
          {posts.map((post, i) => (
            <div key={post.id} style={{ position: "relative", height: viewportHeight, width: "100%" }}>
              <ReelSlide
                post={post}
                isActive={activeIndex === i}
                muted={muted}
                isWideScreen={isWideScreen}
                onTap={() => handleTap(post.id)}
                onDoubleTap={() => handleDoubleTap(post)}
                showHeartBurst={burstFor === post.id}
                liked={state[post.id]?.liked}
                likeCount={state[post.id]?.likeCount || 0}
                saved={state[post.id]?.saved}
                commentCount={state[post.id]?.commentCount || 0}
                onLike={() => handleLike(post)}
                onSave={() => handleSave(post)}
                onShare={() => openShare(post)}
                onOpenComments={() => setCommentsOpenFor(post.id)}
                onTagClick={onTagClick}
              />
            </div>
          ))}
        </div>
      </div>

      {/* One shared comment sheet, sitting outside the scroll-snap
          container. Nesting it per-slide (even hidden/translated off
          screen) still counted toward each slide's scrollable area and
          threw off scroll-snap alignment, which is what was squishing
          the video into the bottom of the screen. */}
      {commentsOpenFor && (
        <CommentSheet
          post={posts.find((p) => p.id === commentsOpenFor)}
          authedFetch={authedFetch}
          commentCount={state[commentsOpenFor]?.commentCount || 0}
          onCountChange={(fn) => update(commentsOpenFor, (cur) => ({ commentCount: fn(cur.commentCount) }))}
          open={!!commentsOpenFor}
          onClose={() => setCommentsOpenFor(null)}
        />
      )}

      {shareFor && (
        <ShareToChatModal groups={shareGroups} onClose={() => setShareFor(null)} onShare={handleShareTo} />
      )}
    </div>
  );
}
