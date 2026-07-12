import { useState } from "react";

export default function PostCard({ post, isMine, authedFetch, onDeleted }) {
  const [liked, setLiked] = useState(post.likedByMe);
  const [likeCount, setLikeCount] = useState(post.likeCount);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState("");
  const [commentCount, setCommentCount] = useState(post.commentCount);

  const time = post.createdAt?._seconds
    ? new Date(post.createdAt._seconds * 1000)
    : new Date();

  async function handleLike() {
    setLiked((v) => !v);
    setLikeCount((c) => (liked ? c - 1 : c + 1));
    await authedFetch(`/api/posts/${post.id}/like`, { method: "POST" }).catch(() => {});
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

  return (
    <div style={{ borderBottom: "1px solid var(--border)", padding: "20px 0" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 20px 12px" }}>
        <div className="avatar-badge" style={{ width: 36, height: 36, fontSize: "0.8rem" }}>
          {post.authorName?.slice(0, 2).toUpperCase()}
        </div>
        <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>{post.authorName}</div>
        <div style={{ marginLeft: "auto", fontFamily: "var(--font-mono)", fontSize: "0.7rem", color: "var(--text-dim)" }}>
          {time.toLocaleDateString()} {time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </div>
      </div>

      {post.mediaBase64 && (
        <img src={post.mediaBase64} alt="post" style={{ width: "100%", maxHeight: 480, objectFit: "cover", display: "block" }} />
      )}

      <div style={{ padding: "12px 20px 0" }}>
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <button
            onClick={handleLike}
            style={{ background: "none", border: "none", fontSize: "1.3rem", color: liked ? "var(--danger)" : "var(--text-secondary)" }}
          >
            {liked ? "♥" : "♡"}
          </button>
          <button onClick={toggleComments} style={{ background: "none", border: "none", fontSize: "1.1rem", color: "var(--text-secondary)" }}>
            💬
          </button>
          {isMine && (
            <button onClick={handleDelete} style={{ marginLeft: "auto", background: "none", border: "none", fontSize: "0.78rem", color: "var(--danger)" }}>
              Delete
            </button>
          )}
        </div>
        <div style={{ fontWeight: 600, fontSize: "0.85rem", margin: "8px 0 4px" }}>{likeCount} like{likeCount !== 1 ? "s" : ""}</div>
        {post.text && <div style={{ fontSize: "0.92rem", marginBottom: 6 }}><b>{post.authorName}</b> {post.text}</div>}
        {commentCount > 0 && !showComments && (
          <button onClick={toggleComments} style={{ background: "none", border: "none", color: "var(--text-secondary)", fontSize: "0.82rem", padding: 0 }}>
            View all {commentCount} comment{commentCount !== 1 ? "s" : ""}
          </button>
        )}
      </div>

      {showComments && (
        <div style={{ padding: "8px 20px 0" }}>
          {comments.map((c, i) => (
            <div key={c.id || i} style={{ fontSize: "0.86rem", marginBottom: 6 }}>
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
    </div>
  );
}
