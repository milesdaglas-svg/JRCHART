import { useState, useRef, useEffect } from "react";
import ShareToChatModal from "./ShareToChatModal.jsx";
import VideoEmbed from "./VideoEmbed.jsx";
import ForwardIcon from "./ForwardIcon.jsx";

export default function PostCard({ post, isMine, authedFetch, onDeleted, onTagClick, onOpenVideo }) {
  const [liked, setLiked] = useState(post.likedByMe);
  const [likeCount, setLikeCount] = useState(post.likeCount);
  const [saved, setSaved] = useState(post.savedByMe);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState("");
  const [commentCount, setCommentCount] = useState(post.commentCount);
  const [showShare, setShowShare] = useState(false);
  const [chats, setChats] = useState([]);

  const time = post.createdAt?._seconds
    ? new Date(post.createdAt._seconds * 1000)
    : new Date();

  const videoRef = useRef(null);

  // Muted autoplay preview in-feed, like Instagram/TikTok, once the
  // clip scrolls into view. Tapping it opens the full Reels viewer.
  useEffect(() => {
    if (post.mediaType !== "video") return;
    const el = videoRef.current;
    if (!el) return;
    // React doesn't reliably set the `muted` DOM attribute from the JSX
    // prop alone — without this, the browser silently blocks autoplay
    // and the video just sits frozen on a black frame.
    el.muted = true;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          const p = el.play();
          if (p && p.catch) p.catch(() => {});
        } else {
          el.pause();
        }
      },
      { threshold: 0.6 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [post.mediaType]);

  async function handleLike() {
    setLiked((v) => !v);
    setLikeCount((c) => (liked ? c - 1 : c + 1));
    await authedFetch(`/api/posts/${post.id}/like`, { method: "POST" }).catch(() => {});
  }

  async function handleSave() {
    setSaved((v) => !v);
    await authedFetch(`/api/posts/${post.id}/save`, { method: "POST" }).catch(() => {});
  }

  async function toggleComments() {
    const next = !showComments;
    setShowComments(next);
    if (next && comments.length === 0) {
      const c = await authedFetch(`/api/posts/${post.id}/comments`).catch(() => []);
      setComments(c);
    }
  }

  async function handleComment(e) {
    e.preventDefault();
    if (!commentText.trim()) return;
    const text = commentText.trim();
    setCommentText("");
    await authedFetch(`/api/posts/${post.id}/comments`, {
      method: "POST",
      body: JSON.stringify({ text }),
    }).catch(() => {});
    setComments((prev) => [...prev, { text, authorName: "You" }]);
    setCommentCount((c) => c + 1);
  }

  async function handleDelete() {
    if (!confirm("Delete this post?")) return;
    await authedFetch(`/api/posts/${post.id}`, { method: "DELETE" }).catch(() => {});
    onDeleted(post.id);
  }

  async function openShare() {
    const g = await authedFetch("/api/groups").catch(() => []);
    setChats(g);
    setShowShare(true);
  }

  async function handleShare(groupId) {
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
    setShowShare(false);
  }

  return (
    <div style={{ borderBottom: "1px solid var(--border)", padding: "18px 0" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 16px 12px" }}>
        <div
          className="avatar-badge"
          style={{
            width: 34,
            height: 34,
            fontSize: "0.75rem",
            flexShrink: 0,
            ...(post.authorPhotoURL ? { backgroundImage: `url(${post.authorPhotoURL})`, backgroundSize: "cover", backgroundPosition: "center" } : {}),
          }}
        >
          {!post.authorPhotoURL && post.authorName?.slice(0, 2).toUpperCase()}
        </div>
        <div style={{ fontWeight: 600, fontSize: "clamp(0.8rem, 3vw, 0.9rem)" }}>{post.authorName}</div>
        <div style={{ marginLeft: "auto", fontFamily: "var(--font-mono)", fontSize: "clamp(0.6rem, 2.2vw, 0.7rem)", color: "var(--text-dim)" }}>
          {time.toLocaleDateString()} {time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </div>
      </div>

      {/* Media is inset from the screen edges with rounded corners,
          instead of running flush edge-to-edge. */}
      {post.mediaType === "embed" && (
        <div style={{ position: "relative", padding: "0 16px" }}>
          <div style={{ borderRadius: 14, overflow: "hidden" }}>
            <VideoEmbed platform={post.embedPlatform} embedId={post.embedId} embedHtml={post.embedHtml} />
          </div>
          <button
            onClick={() => onOpenVideo?.(post)}
            style={{ position: "absolute", top: 10, right: 26, background: "rgba(0,0,0,0.55)", color: "#fff", border: "none", borderRadius: 14, padding: "5px 10px", fontSize: "0.7rem", cursor: "pointer" }}
          >
            ⤢ Reels view
          </button>
        </div>
      )}
      {post.mediaType === "video" && post.videoUrl && (
        <div style={{ padding: "0 16px" }}>
          <div style={{ position: "relative", cursor: "pointer", borderRadius: 14, overflow: "hidden" }} onClick={() => onOpenVideo?.(post)}>
            <video
              ref={videoRef}
              src={post.videoUrl}
              poster={post.thumbnailUrl || undefined}
              muted
              loop
              playsInline
              preload="metadata"
              style={{ width: "100%", maxHeight: 500, objectFit: "cover", display: "block", background: "#000" }}
            />
            <span style={{ position: "absolute", bottom: 10, right: 12, fontSize: "0.68rem", color: "#fff", background: "rgba(0,0,0,0.45)", padding: "3px 8px", borderRadius: 10 }}>
              Tap to view
            </span>
          </div>
        </div>
      )}
      {post.mediaType === "image" && post.mediaBase64 && (
        <div style={{ padding: "0 16px" }}>
          <img src={post.mediaBase64} alt="post" style={{ width: "100%", maxHeight: 460, objectFit: "cover", display: "block", borderRadius: 14 }} />
        </div>
      )}

      <div style={{ padding: "12px 16px 0" }}>
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <button onClick={handleLike} style={{ background: "none", border: "none", fontSize: "1.25rem", color: liked ? "var(--danger)" : "var(--text-secondary)" }}>
            {liked ? "♥" : "♡"}
          </button>
          <button onClick={toggleComments} style={{ background: "none", border: "none", fontSize: "1.05rem", color: "var(--text-secondary)" }}>
            💬
          </button>
          <button onClick={openShare} style={{ background: "none", border: "none", color: "var(--text-secondary)", display: "flex" }}>
            <ForwardIcon size={19} />
          </button>
          <button onClick={handleSave} style={{ marginLeft: "auto", background: "none", border: "none", fontSize: "1.15rem", color: saved ? "var(--accent)" : "var(--text-secondary)" }}>
            {saved ? "🔖" : "📑"}
          </button>
        </div>

        <div style={{ fontWeight: 600, fontSize: "clamp(0.75rem, 2.8vw, 0.85rem)", margin: "8px 0 4px" }}>
          {likeCount} like{likeCount !== 1 ? "s" : ""}
        </div>

        {post.text && (
          <div style={{ fontSize: "clamp(0.8rem, 3vw, 0.92rem)", marginBottom: 6, wordBreak: "break-word" }}>
            <b>{post.authorName}</b>{" "}
            {post.text.split(/(\s+)/).map((word, i) =>
              word.startsWith("#") ? (
                <span key={i} onClick={() => onTagClick?.(word.replace("#", ""))} style={{ color: "var(--accent)", cursor: "pointer" }}>
                  {word}
                </span>
              ) : (
                word
              )
            )}
          </div>
        )}

        {commentCount > 0 && !showComments && (
          <button onClick={toggleComments} style={{ background: "none", border: "none", color: "var(--text-secondary)", fontSize: "clamp(0.72rem, 2.6vw, 0.82rem)", padding: 0 }}>
            View all {commentCount} comment{commentCount !== 1 ? "s" : ""}
          </button>
        )}

        {isMine && (
          <div style={{ marginTop: 8 }}>
            <button onClick={handleDelete} style={{ background: "none", border: "none", fontSize: "0.75rem", color: "var(--danger)", padding: 0 }}>
              Delete post
            </button>
          </div>
        )}
      </div>

      {showComments && (
        <div style={{ padding: "8px 16px 0" }}>
          {comments.map((c, i) => (
            <div key={c.id || i} style={{ fontSize: "clamp(0.75rem, 2.7vw, 0.86rem)", marginBottom: 6, wordBreak: "break-word" }}>
              <b>{c.authorName}</b> {c.text}
            </div>
          ))}
          <form onSubmit={handleComment} style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <input
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Add a comment…"
              style={{ flex: 1, padding: "8px 12px", borderRadius: 16, fontSize: "0.85rem" }}
            />
            <button className="pill-btn accent" type="submit">Post</button>
          </form>
        </div>
      )}

      {showShare && (
        <ShareToChatModal groups={chats} onClose={() => setShowShare(false)} onShare={handleShare} />
      )}
    </div>
  );
}