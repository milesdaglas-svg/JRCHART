import { useEffect, useState } from "react";
import PostCard from "./PostCard.jsx";
import { compressImageToBase64 } from "../utils/compressImage.js";

export default function Feed({ authedFetch, myId }) {
  const [posts, setPosts] = useState([]);
  const [text, setText] = useState("");
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [posting, setPosting] = useState(false);

  async function load() {
    const p = await authedFetch("/api/posts").catch(() => []);
    setPosts(p);
  }

  useEffect(() => {
    load();
  }, []);

  function handleFile(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  async function handlePost(e) {
    e.preventDefault();
    if (!text.trim() && !file) return;
    setPosting(true);
    try {
      let mediaBase64 = null;
      if (file) mediaBase64 = await compressImageToBase64(file);
      await authedFetch("/api/posts", {
        method: "POST",
        body: JSON.stringify({ text: text.trim() || null, mediaBase64 }),
      });
      setText("");
      setFile(null);
      setPreview(null);
      await load();
    } catch (err) {
      alert(err.message);
    } finally {
      setPosting(false);
    }
  }

  function handleDeleted(id) {
    setPosts((prev) => prev.filter((p) => p.id !== id));
  }

  return (
    <div style={{ maxWidth: 560, margin: "0 auto", width: "100%", height: "100%", overflowY: "auto" }}>
      <form onSubmit={handlePost} style={{ padding: 20, borderBottom: "1px solid var(--border)" }}>
        {preview && (
          <img src={preview} alt="preview" style={{ width: "100%", borderRadius: 10, marginBottom: 10, maxHeight: 300, objectFit: "cover" }} />
        )}
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Share something…"
          rows={2}
          style={{ width: "100%", padding: 12, borderRadius: 10, resize: "none", fontSize: "0.95rem" }}
        />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10 }}>
          <label style={{ cursor: "pointer", color: "var(--text-secondary)", fontSize: "0.85rem" }}>
            📷 Add photo
            <input type="file" accept="image/*" onChange={handleFile} style={{ display: "none" }} />
          </label>
          <button className="btn-accent" disabled={posting}>{posting ? "Posting…" : "Post"}</button>
        </div>
      </form>

      {posts.map((p) => (
        <PostCard key={p.id} post={p} isMine={p.userId === myId} authedFetch={authedFetch} onDeleted={handleDeleted} />
      ))}
      {posts.length === 0 && (
        <p style={{ padding: 24, textAlign: "center", color: "var(--text-secondary)" }}>
          No posts yet — be the first to share something.
        </p>
      )}
    </div>
  );
}
