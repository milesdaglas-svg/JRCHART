import { useEffect, useState } from "react";

const SEEN_KEY = "jrchart_seen_stories";

function loadSeen() {
  try {
    return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) || "[]"));
  } catch {
    return new Set();
  }
}

export default function StatusFeed({ stories, myId, myPhotoURL, onAddStory, onView, myStoryPosted }) {
  const [seen, setSeen] = useState(loadSeen);

  // Re-check what's been seen whenever the story list changes (e.g. after
  // coming back from the viewer) so rings update without a full reload.
  useEffect(() => {
    setSeen(loadSeen());
  }, [stories]);

  const mine = stories.filter((s) => s.userId === myId).sort((a, b) => (a.createdAt?._seconds || 0) - (b.createdAt?._seconds || 0));

  // Group everyone else's stories by person, most-recently-posted person first.
  const groups = new Map();
  stories
    .filter((s) => s.userId !== myId)
    .forEach((s) => {
      if (!groups.has(s.userId)) groups.set(s.userId, []);
      groups.get(s.userId).push(s);
    });
  const others = [...groups.values()]
    .map((group) => group.sort((a, b) => (a.createdAt?._seconds || 0) - (b.createdAt?._seconds || 0)))
    .sort((a, b) => (b[b.length - 1].createdAt?._seconds || 0) - (a[a.length - 1].createdAt?._seconds || 0));

  function openGroup(group) {
    const allSeen = group.every((s) => seen.has(s.id));
    const startIndex = allSeen ? 0 : group.findIndex((s) => !seen.has(s.id));
    onView(group, Math.max(0, startIndex));
    const updated = new Set(seen);
    group.forEach((s) => updated.add(s.id));
    setSeen(updated);
    localStorage.setItem(SEEN_KEY, JSON.stringify([...updated]));
  }

  return (
    <div className="scroll-panel">
      <div className="status-feed-item" style={{ position: "relative" }}>
        <div
          className="status-thumb"
          style={{
            cursor: myStoryPosted ? "pointer" : "default",
            ...(mine[mine.length - 1]?.mediaBase64
              ? { backgroundImage: `url(${mine[mine.length - 1].mediaBase64})` }
              : myPhotoURL
              ? { backgroundImage: `url(${myPhotoURL})`, backgroundSize: "cover" }
              : {}),
          }}
          onClick={() => myStoryPosted && openGroup(mine)}
        >
          {!mine[mine.length - 1]?.mediaBase64 && !myPhotoURL && !myStoryPosted && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", fontSize: "1.4rem" }}>+</div>
          )}
        </div>
        <button
          className="status-add-badge"
          onClick={(e) => {
            e.stopPropagation();
            onAddStory();
          }}
          title="Add a status update"
        >
          +
        </button>
        <div onClick={() => (myStoryPosted ? openGroup(mine) : onAddStory())} style={{ cursor: "pointer", flex: 1 }}>
          <div className="person-name">Your status</div>
          <div className="person-sub">
            {myStoryPosted ? `${mine.length} update${mine.length === 1 ? "" : "s"} · tap to view` : "Tap to add a status update"}
          </div>
        </div>
      </div>

      <div className="list-section-label">Recent updates</div>
      {others.map((group) => {
        const last = group[group.length - 1];
        const allSeen = group.every((s) => seen.has(s.id));
        return (
          <div key={group[0].userId} className="status-feed-item" style={{ cursor: "pointer" }} onClick={() => openGroup(group)}>
            <div
              className="status-thumb"
              style={{
                ...(last.mediaBase64 ? { backgroundImage: `url(${last.mediaBase64})` } : {}),
                ...(last.thumbnailUrl ? { backgroundImage: `url(${last.thumbnailUrl})`, backgroundSize: "cover" } : {}),
                borderColor: allSeen ? "var(--border)" : "var(--accent)",
              }}
            >
              {!last.mediaBase64 && !last.thumbnailUrl && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-primary)", fontWeight: 600 }}>
                  {(last.authorName || "?").slice(0, 2).toUpperCase()}
                </div>
              )}
            </div>
            <div>
              <div className="person-name">{last.authorName}</div>
              <div className="person-sub">
                {group.length > 1 ? `${group.length} updates · ` : ""}
                disappears in 24h
              </div>
            </div>
          </div>
        );
      })}
      {others.length === 0 && (
        <p style={{ padding: 16, color: "var(--text-secondary)", fontSize: "0.85rem" }}>
          No updates from anyone right now.
        </p>
      )}
    </div>
  );
}
