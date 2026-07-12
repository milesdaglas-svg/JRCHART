import { useEffect, useState } from "react";
import PostCard from "./PostCard.jsx";
import { compressImageToBase64 } from "../utils/compressImage.js";
import { uploadToCloudinary } from "../utils/uploadToCloudinary.js";

export default function Feed({ authedFetch, myId }) {
  const [posts, setPosts] = useState([]);
  const [view, setView] = useState("forYou"); // forYou | saved
  const [activeTag, setActiveTag] = useState(null);
  const [searchInput, setSearchInput] = useState("");

  const [text, setText] = useState("");
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [isVideo, setIsVideo] = useState(false);
  const [posting, setPosting] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");

  async function load() {
    if (view === "saved") {
      const p = await authedFetch("/api/posts/saved").catch(() => []);
      setPosts(p);
    } else {
      const path = activeTag ? `/api/posts?tag=${encodeURIComponent(activeTag)}` : "/api/posts";
      const p = await authedFetch(path).catch(() => []);
      setPosts(p);
    }
  }

  useEffect(() => {
    load();
  }, [view, activeTag]);

  function handleFile(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setIsVideo(f.type.startsWith("video/"));
    setPreview(URL.createObjectURL(f));
  }

  async function handlePost(e) {
    e.preventDefault();
    if (!text.trim() && !file) return;
    setPosting(true);
    try {
      let mediaBase64 = null;
      let videoUrl = null;

      if (file && isVideo) {
        setUploadStatus("Uploading video…");
        videoUrl = await uploadToCloudinary(file, "video");
      } else if (file) {
        mediaBase64 = await compressImageToBase64(file);
      }

      await authedFetch("/api/posts", {
        method: "POST",
        body: JSON.stringify({ text: text.trim() || null, mediaBase64, videoUrl }),
      });

      setText("");
      setFile(null);
      setPreview(null);
      setIsVideo(false);
      setUploadStatus("");
      if (view === "forYou" && !activeTag) await load();
    } catch (err) {
      alert(err.message);
      setUploadStatus("");
    } finally {
      setPosting(false);
    }
  }

  function handleDeleted(id) {
    setPosts((prev) => prev.filter((p) => p.id !== id));
  }

  function handleSearch(e) {
    e.preventDefault();
    const term = searchInput.trim().replace(/^#/, "");
    if (term) {
      setView("forYou");
      setActiveTag(term);
    }
  }

  return (
    <div style={{ maxWidth: 560, margin: "0 auto", width: "100%", height: "100%", overflowY: "auto" }}>
      <div style={{ display: "flex", gap: 10, padding: "16px 20px 0" }}>
        <button
          className={`pill-btn ${view === "forYou" && !activeTag ? "accent" : ""}`}
          onClick={() => { setView("forYou"); setActiveTag(null); }}
        >
          For you
        </button>
        <button className={`pill-btn ${view === "saved" ? "accent" : ""}`} onClick={() => setView("saved")}>
          Saved
        </button>
        {activeTag && (
          <button className="pill-btn accent" onClick={() => setActiveTag(null)}>
            #{activeTag} ✕
          </button>
        )}
      </div>

      <form onSubmit={handleSearch} style={{ padding: "12px 20px 0" }}>
        <input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search a topic, e.g. #travel"
          style={{ width: "100%", padding: "10px 14px", borderRadius: 20, fontSize: "0.88rem" }}
        />
      </form>

      <form onSubmit={handlePost} style={{ padding: 20, borderBottom: "1px solid var(--border)", marginTop: 8 }}>
        {preview && !isVideo && (
          <img src={preview} alt="preview" style={{ width: "100%", borderRadius: 10, marginBottom: 10, maxHeight: 300, objectFit: "cover" }} />
        )}
        {preview && isVideo && (
          <video src={preview} controls style={{ width: "100%", borderRadius: 10, marginBottom: 10, maxHeight: 300 }} />
        )}
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Share something… use #tags so people can find it"
          rows={2}
          style={{ width: "100%", padding: 12, borderRadius: 10, resize: "none", fontSize: "0.95rem" }}
        />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10 }}>
          <label style={{ cursor: "pointer", color: "var(--text-secondary)", fontSize: "0.85rem" }}>
            📷 Photo or 🎥 video
            <input type="file" accept="image/*,video/*" onChange={handleFile} style={{ display: "none" }} />
          </label>
          <button className="btn-accent" disabled={posting}>
            {posting ? uploadStatus || "Posting…" : "Post"}
          </button>
        </div>
      </form>

      {posts.map((p) => (
        <PostCard key={p.id} post={p} isMine={p.userId === myId} authedFetch={authedFetch} onDeleted={handleDeleted} onTagClick={setActiveTag} />
      ))}
      {posts.length === 0 && (
        <p style={{ padding: 24, textAlign: "center", color: "var(--text-secondary)" }}>
          {view === "saved" ? "Nothing saved yet." : "No posts here yet — be the first to share something."}
        </p>
      )}
    </div>
  );
}
