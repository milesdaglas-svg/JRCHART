import { useEffect, useState } from "react";
import PostCard from "./PostCard.jsx";
import VideoEmbed from "./VideoEmbed.jsx";
import ReelsViewer from "./ReelsViewer.jsx";
import { compressImageToBase64 } from "../utils/compressImage.js";
import { uploadToCloudinary } from "../utils/uploadToCloudinary.js";
import { resolveEmbed } from "../utils/resolveEmbed.js";

export default function Feed({ authedFetch, myId }) {
  const [posts, setPosts] = useState([]);
  const [view, setView] = useState("forYou");
  const [activeTag, setActiveTag] = useState(null);
  const [searchInput, setSearchInput] = useState("");

  const [text, setText] = useState("");
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [isVideo, setIsVideo] = useState(false);
  const [posting, setPosting] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");

  const [linkInput, setLinkInput] = useState("");
  const [resolvedEmbed, setResolvedEmbed] = useState(null);
  const [resolvingLink, setResolvingLink] = useState(false);

  // Reels-style viewer: tapping any video/embed post opens this,
  // starting at that clip, and you can keep scrolling through the rest.
  const [reelsIndex, setReelsIndex] = useState(null);
  const videoPosts = posts.filter((p) => p.mediaType === "video" || p.mediaType === "embed");

  function openReels(post) {
    const idx = videoPosts.findIndex((v) => v.id === post.id);
    if (idx !== -1) setReelsIndex(idx);
  }

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
    setResolvedEmbed(null);
    setLinkInput("");
  }

  async function handleResolveLink() {
    if (!linkInput.trim()) return;
    setResolvingLink(true);
    try {
      const result = await resolveEmbed(authedFetch, linkInput.trim());
      setResolvedEmbed(result);
      setFile(null);
      setPreview(null);
    } catch (err) {
      alert(err.message);
    } finally {
      setResolvingLink(false);
    }
  }

  async function handlePost(e) {
    e.preventDefault();
    if (!text.trim() && !file && !resolvedEmbed) return;
    setPosting(true);
    try {
      let mediaBase64 = null;
      let videoUrl = null;
      let thumbnailUrl = null;
      let durationSeconds = null;

      if (file && isVideo) {
        setUploadStatus("Uploading video…");
        const uploaded = await uploadToCloudinary(file, "video");
        videoUrl = uploaded.url;
        thumbnailUrl = uploaded.thumbnailUrl;
        durationSeconds = uploaded.durationSeconds;
      } else if (file) {
        mediaBase64 = await compressImageToBase64(file);
      }

      await authedFetch("/api/posts", {
        method: "POST",
        body: JSON.stringify({
          text: text.trim() || null,
          mediaBase64,
          videoUrl,
          thumbnailUrl,
          durationSeconds,
          embedPlatform: resolvedEmbed?.platform || null,
          embedId: resolvedEmbed?.embedId || null,
          embedHtml: resolvedEmbed?.embedHtml || null,
        }),
      });

      setText("");
      setFile(null);
      setPreview(null);
      setIsVideo(false);
      setUploadStatus("");
      setLinkInput("");
      setResolvedEmbed(null);
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
        {resolvedEmbed && (
          <div style={{ marginBottom: 10 }}>
            <VideoEmbed platform={resolvedEmbed.platform} embedId={resolvedEmbed.embedId} embedHtml={resolvedEmbed.embedHtml} />
          </div>
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
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <input
            value={linkInput}
            onChange={(e) => setLinkInput(e.target.value)}
            placeholder="Paste a YouTube or TikTok link…"
            style={{ flex: 1, padding: "8px 12px", borderRadius: 8, fontSize: "0.85rem" }}
          />
          <button type="button" className="pill-btn" onClick={handleResolveLink} disabled={resolvingLink}>
            {resolvingLink ? "Loading…" : "Attach"}
          </button>
        </div>
      </form>

      {posts.map((p) => (
        <PostCard
          key={p.id}
          post={p}
          isMine={p.userId === myId}
          authedFetch={authedFetch}
          onDeleted={handleDeleted}
          onTagClick={setActiveTag}
          onOpenVideo={openReels}
        />
      ))}
      {posts.length === 0 && (
        <p style={{ padding: 24, textAlign: "center", color: "var(--text-secondary)" }}>
          {view === "saved" ? "Nothing saved yet." : "No posts here yet — be the first to share something."}
        </p>
      )}

      {reelsIndex !== null && (
        <ReelsViewer
          posts={videoPosts}
          startIndex={reelsIndex}
          authedFetch={authedFetch}
          onClose={() => setReelsIndex(null)}
          onTagClick={(t) => {
            setReelsIndex(null);
            setActiveTag(t);
          }}
        />
      )}
    </div>
  );
}