import { useRef, useState } from "react";

function VoiceNoteBubble({ url, duration, isMine }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0); // 0–1
  const [current, setCurrent] = useState(0);

  function toggle() {
    const el = audioRef.current;
    if (!el) return;
    if (playing) {
      el.pause();
    } else {
      el.play();
    }
  }

  function fmt(seconds) {
    const s = Math.max(0, Math.round(seconds || 0));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  }

  return (
    <div className="voice-note-bubble">
      <audio
        ref={audioRef}
        src={url}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setProgress(0);
          setCurrent(0);
        }}
        onTimeUpdate={(e) => {
          const el = e.currentTarget;
          setCurrent(el.currentTime);
          if (el.duration) setProgress(el.currentTime / el.duration);
        }}
      />
      <button type="button" className="voice-note-play" onClick={toggle}>
        {playing ? "⏸" : "▶"}
      </button>
      <div className="voice-note-track">
        <div className="voice-note-track-fill" style={{ width: `${progress * 100}%` }} />
      </div>
      <span className="voice-note-time">{fmt(playing || current ? current : duration)}</span>
    </div>
  );
}

export default function MessageBubble({ message, isMine, onDelete }) {
  const time = message.createdAt
    ? new Date(
        message.createdAt._seconds ? message.createdAt._seconds * 1000 : message.createdAt
      ).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "";

  if (message.isWarning) {
    return (
      <div className="bubble warning">
        <div>⚠️ {message.text}</div>
        <div className="bubble-meta">{time}</div>
      </div>
    );
  }

  return (
    <div className={`bubble ${isMine ? "mine" : "theirs"}`} style={{ position: "relative" }}>
      {message.isSystem && !isMine && (
        <div style={{ fontSize: "0.72rem", fontWeight: 700, opacity: 0.7, marginBottom: 2 }}>
          {message.senderName || "System"}
        </div>
      )}

      {message.sharedPost && (
        <div style={{ background: "rgba(0,0,0,0.15)", borderRadius: 8, overflow: "hidden", marginBottom: 6, maxWidth: 220 }}>
          {message.sharedPost.mediaBase64 && (
            <img src={message.sharedPost.mediaBase64} alt="shared post" style={{ width: "100%", display: "block", maxHeight: 160, objectFit: "cover" }} />
          )}
          {message.sharedPost.videoUrl && (
            <video src={message.sharedPost.videoUrl} style={{ width: "100%", display: "block", maxHeight: 160 }} muted />
          )}
          <div style={{ padding: "6px 8px", fontSize: "0.78rem" }}>
            <b>{message.sharedPost.authorName}</b>
            {message.sharedPost.text && <div style={{ opacity: 0.85 }}>{message.sharedPost.text}</div>}
          </div>
        </div>
      )}

      {message.audioUrl && (
        <VoiceNoteBubble url={message.audioUrl} duration={message.audioDuration} isMine={isMine} />
      )}

      {message.text && <div>{message.text}</div>}
      <div className="bubble-meta">{time}</div>

      {isMine && onDelete && (
        <button
          onClick={onDelete}
          title="Delete message"
          style={{
            position: "absolute",
            top: -8,
            right: -8,
            width: 20,
            height: 20,
            borderRadius: "50%",
            border: "none",
            background: "var(--bg-surface-2)",
            color: "var(--text-secondary)",
            fontSize: "0.7rem",
            lineHeight: 1,
            opacity: 0,
            transition: "opacity 0.15s ease",
          }}
          className="msg-delete-btn"
        >
          ✕
        </button>
      )}
    </div>
  );
}
