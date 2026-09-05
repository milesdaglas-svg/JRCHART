import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { API_URL, auth } from "../firebase";
import MessageBubble from "../components/MessageBubble.jsx";
import GroupModal from "../components/GroupModal.jsx";
import AddMemberModal from "../components/AddMemberModal.jsx";
import BrowseGroupsModal from "../components/BrowseGroupsModal.jsx";
import SideMenu from "../components/SideMenu.jsx";
import StoryComposerModal from "../components/StoryComposerModal.jsx";
import StoryViewerModal from "../components/StoryViewerModal.jsx";
import QuickAppsPanel from "../components/QuickAppsPanel.jsx";
import VoiceAssistant from "../components/VoiceAssistant.jsx";
import PeopleList from "../components/PeopleList.jsx";
import StatusFeed from "../components/StatusFeed.jsx";
import ShareToChatModal from "../components/ShareToChatModal.jsx";
import Feed from "../components/Feed.jsx";
import { compressImageToBase64 } from "../utils/compressImage.js";
import { uploadToCloudinary } from "../utils/uploadToCloudinary.js";

export default function Home() {
  // Track the real, visible viewport height (window.innerHeight doesn't
  // update reliably as the on-screen keyboard opens/closes on mobile,
  // which is what made the whole layout — composer included — jump
  // around instead of staying put while typing).
  useEffect(() => {
    function setAppHeight() {
      const h = window.visualViewport?.height || window.innerHeight;
      document.documentElement.style.setProperty("--app-height", `${h}px`);
    }
    setAppHeight();
    window.visualViewport?.addEventListener("resize", setAppHeight);
    window.addEventListener("resize", setAppHeight);
    return () => {
      window.visualViewport?.removeEventListener("resize", setAppHeight);
      window.removeEventListener("resize", setAppHeight);
    };
  }, []);

  const { profile, authedFetch, logout } = useAuth();
  const [tab, setTab] = useState("feed"); // chats | status | people | feed
  const [groups, setGroups] = useState([]);
  const [activeGroup, setActiveGroup] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");

  // Voice notes: tap-to-record, WhatsApp-style — the send button morphs
  // into a mic when the draft is empty, tapping it records, tapping the
  // checkmark uploads and sends, tapping the trash discards.
  const [recording, setRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [sendingVoiceNote, setSendingVoiceNote] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);
  const recordingCancelledRef = useRef(false);
  const [stories, setStories] = useState([]);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [showBrowseGroups, setShowBrowseGroups] = useState(false);
  const [showSideMenu, setShowSideMenu] = useState(false);
  const [chatSearch, setChatSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [showStoryComposer, setShowStoryComposer] = useState(false);
  const [viewingStoryGroup, setViewingStoryGroup] = useState(null); // { stories, startIndex, isMine }
  const [shareStoryTarget, setShareStoryTarget] = useState(null);

  function openStoryGroup(storyOrGroup, maybeIndex) {
    if (Array.isArray(storyOrGroup)) {
      setViewingStoryGroup({
        stories: storyOrGroup,
        startIndex: maybeIndex || 0,
        isMine: storyOrGroup[0]?.userId === profile?.id,
      });
      return;
    }
    const story = storyOrGroup;
    const group = stories
      .filter((s) => s.userId === story.userId)
      .sort((a, b) => (a.createdAt?._seconds || 0) - (b.createdAt?._seconds || 0));
    const idx = Math.max(0, group.findIndex((s) => s.id === story.id));
    setViewingStoryGroup({ stories: group, startIndex: idx, isMine: story.userId === profile?.id });
  }

  async function handleReshareStory(groupId) {
    const story = shareStoryTarget;
    if (!story) return;
    await authedFetch(`/api/groups/${groupId}/messages`, {
      method: "POST",
      body: JSON.stringify({
        text: "",
        sharedPost: {
          postId: story.id,
          authorName: story.authorName,
          text: story.text,
          mediaBase64: story.mediaBase64,
          videoUrl: story.videoUrl,
        },
      }),
    }).catch((err) => alert(err.message));
    setShareStoryTarget(null);
  }
  const [showQuickApps, setShowQuickApps] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const socketRef = useRef(null);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  async function refreshGroups() {
    const g = await authedFetch("/api/groups").catch(() => []);
    setGroups(g);
    return g;
  }

  // --- initial load: groups + stories, and connect the socket ---
  useEffect(() => {
    (async () => {
      const g = await refreshGroups();
      if (g.length) setActiveGroup(g[0]);
      const s = await authedFetch("/api/stories").catch(() => []);
      setStories(s);
    })();

    (async () => {
      const token = await auth.currentUser?.getIdToken();
      socketRef.current = io(API_URL, { auth: { token } });
      socketRef.current.on("new-message", (msg) => {
        setMessages((prev) => [...prev, msg]);
      });
      socketRef.current.on("message-deleted", (messageId) => {
        setMessages((prev) => prev.filter((m) => m.id !== messageId));
      });
    })();

    return () => socketRef.current?.disconnect();
  }, []);

  // --- load history + join room whenever the active chat changes ---
  useEffect(() => {
    if (!activeGroup) return;

    (async () => {
      const history = await authedFetch(`/api/groups/${activeGroup.id}/messages`).catch(() => []);
      setMessages(history);
    })();

    if (!socketRef.current) return;
    socketRef.current.emit("join-room", activeGroup.id);
    return () => socketRef.current.emit("leave-room", activeGroup.id);
  }, [activeGroup]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const aiName = profile?.aiName || "Jarvis";

  async function handleDeleteMessage(messageId) {
    if (!activeGroup) return;
    await authedFetch(`/api/groups/${activeGroup.id}/messages/${messageId}`, { method: "DELETE" }).catch((err) => alert(err.message));
    setMessages((prev) => prev.filter((m) => m.id !== messageId));
    socketRef.current?.emit("delete-message", { roomId: activeGroup.id, messageId });
  }

  async function sendMessageToGroup(groupId, text) {
    const { id } = await authedFetch(`/api/groups/${groupId}/messages`, {
      method: "POST",
      body: JSON.stringify({ text }),
    });
    const message = { id, senderId: profile.id, text, createdAt: Date.now() };
    if (groupId === activeGroup?.id) {
      setMessages((prev) => [...prev, message]);
    }
    socketRef.current.emit("send-message", { roomId: groupId, message });
  }

  async function startRecording() {
    if (!navigator.mediaDevices?.getUserMedia) {
      alert("Voice notes need microphone access, which this browser doesn't support.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      recordingCancelledRef.current = false;
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        clearInterval(recordingTimerRef.current);
        if (!recordingCancelledRef.current && audioChunksRef.current.length) {
          uploadAndSendVoiceNote();
        }
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
      setRecordingSeconds(0);
      recordingTimerRef.current = setInterval(() => setRecordingSeconds((s) => s + 1), 1000);
    } catch {
      alert("Couldn't access your microphone — check your browser's permissions.");
    }
  }

  function stopRecording(cancel) {
    recordingCancelledRef.current = cancel;
    mediaRecorderRef.current?.stop();
    setRecording(false);
  }

  async function uploadAndSendVoiceNote() {
    if (!activeGroup) return;
    const durationSeconds = recordingSeconds;
    const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
    const file = new File([blob], "voice-note.webm", { type: "audio/webm" });
    setSendingVoiceNote(true);
    try {
      const uploaded = await uploadToCloudinary(file, "video");
      const { id } = await authedFetch(`/api/groups/${activeGroup.id}/messages`, {
        method: "POST",
        body: JSON.stringify({ audioUrl: uploaded.url, audioDuration: uploaded.durationSeconds || durationSeconds }),
      });
      const message = {
        id,
        senderId: profile.id,
        text: "",
        audioUrl: uploaded.url,
        audioDuration: uploaded.durationSeconds || durationSeconds,
        createdAt: Date.now(),
      };
      setMessages((prev) => [...prev, message]);
      socketRef.current.emit("send-message", { roomId: activeGroup.id, message });
    } catch (err) {
      alert(err.message || "Couldn't send that voice note — try again.");
    } finally {
      setSendingVoiceNote(false);
    }
  }

  async function handleSend(e) {
    e.preventDefault();
    if (!draft.trim() || !activeGroup) return;

    const text = draft.trim();
    setDraft("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    const triggerPattern = new RegExp(`^${aiName}[,:]?\\s+`, "i");
    if (triggerPattern.test(text)) {
      const instruction = text.replace(triggerPattern, "");
      setAiBusy(true);
      try {
        const { id, text: draftText } = await authedFetch("/api/ai/compose", {
          method: "POST",
          body: JSON.stringify({ groupId: activeGroup.id, instruction }),
        });
        const message = { id, senderId: profile.id, text: draftText, createdAt: Date.now() };
        setMessages((prev) => [...prev, message]);
        socketRef.current.emit("send-message", { roomId: activeGroup.id, message });
      } catch (err) {
        alert(err.message);
      } finally {
        setAiBusy(false);
      }
      return;
    }

    try {
      await sendMessageToGroup(activeGroup.id, text);
    } catch (err) {
      alert(err.message);
    }
  }

  function handleDraftChange(e) {
    setDraft(e.target.value);
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
    }
  }

  function handleComposerKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend(e);
    }
  }

  async function handleAddMember(email) {
    await authedFetch(`/api/groups/${activeGroup.id}/members`, {
      method: "POST",
      body: JSON.stringify({ email }),
    });
  }

  async function handleCreateGroup(name) {
    const { id } = await authedFetch("/api/groups", {
      method: "POST",
      body: JSON.stringify({ name }),
    });
    const g = await refreshGroups();
    setActiveGroup(g.find((x) => x.id === id) || g[0]);
    setTab("chats");
  }

  async function handleAddStory({ text, file }) {
    let mediaBase64 = null;
    let videoUrl = null;
    let thumbnailUrl = null;
    if (file && file.type.startsWith("video/")) {
      const uploaded = await uploadToCloudinary(file, "video");
      videoUrl = uploaded.url;
      thumbnailUrl = uploaded.thumbnailUrl;
    } else if (file) {
      mediaBase64 = await compressImageToBase64(file);
    }
    await authedFetch("/api/stories", {
      method: "POST",
      body: JSON.stringify({ text: text || null, mediaBase64, videoUrl, thumbnailUrl }),
    });
    const s = await authedFetch("/api/stories").catch(() => []);
    setStories(s);
  }

  async function handleOpenDM(groupId) {
    const g = await refreshGroups();
    setActiveGroup(g.find((x) => x.id === groupId) || null);
    setTab("chats");
  }

  const myStoryPosted = stories.some((s) => s.userId === profile?.id);

  function groupLabel(g) {
    return g.isDM ? g.displayName || "Direct message" : g.name;
  }

  return (
    <div className={`app-shell${activeGroup && tab === "chats" ? " chat-open" : ""}`}>
      {tab === "feed" ? (
        <div className="feed-shell" style={{ gridColumn: "1 / -1", overflow: "hidden" }}>
          <Feed
            authedFetch={authedFetch}
            myId={profile?.id}
            stories={stories}
            myStoryPosted={myStoryPosted}
            onOpenComposer={() => setShowStoryComposer(true)}
            onViewStory={openStoryGroup}
          />
        </div>
      ) : (
        <>
      <aside className="list-panel">
        <div className="list-panel-topbar">
        <div className="list-panel-header">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button className="icon-btn" onClick={() => setShowSideMenu(true)} title="Menu">☰</button>
            <span className="list-panel-title">
              {tab === "chats" ? "Chats" : tab === "status" ? "Status" : "People"}
            </span>
          </div>
          {tab === "chats" && (
            <div className="header-icon-group">
              <button
                className="icon-btn"
                onClick={() => setSearchOpen((v) => !v)}
                title="Search chats"
              >
                🔍
              </button>
              <VoiceAssistant
                compact
                aiName={aiName}
                groups={groups}
                activeGroupId={activeGroup?.id}
                authedFetch={authedFetch}
                onExecuteSend={sendMessageToGroup}
              />
              <button className="icon-btn" onClick={() => setShowBrowseGroups(true)} title="Browse groups">🧭</button>
              <button className="icon-btn" onClick={() => setShowGroupModal(true)} title="New group">+</button>
            </div>
          )}
        </div>

        {tab === "chats" && searchOpen && (
          <div className="chat-search-wrap">
            <input
              className="chat-search-bar"
              placeholder="Search"
              value={chatSearch}
              autoFocus
              onChange={(e) => setChatSearch(e.target.value)}
              onBlur={() => {
                if (!chatSearch) setSearchOpen(false);
              }}
            />
          </div>
        )}

        {stories.some((s) => s.userId !== profile?.id) && (
          <div className="story-rail">
            {stories
              .filter((s) => s.userId !== profile?.id)
              .map((s) => (
                <div
                  key={s.id}
                  className="story-avatar"
                  title={s.text || "Story"}
                  onClick={() => openStoryGroup(s)}
                >
                  <div style={s.mediaBase64 ? { backgroundImage: `url(${s.mediaBase64})`, backgroundSize: "cover" } : undefined}>
                    {!s.mediaBase64 && (s.userId || "?").slice(0, 2).toUpperCase()}
                  </div>
                </div>
              ))}
          </div>
        )}
        </div>

        {tab === "chats" && (
          <div className="scroll-panel">
            {groups
              .filter((g) => groupLabel(g)?.toLowerCase().includes(chatSearch.toLowerCase()))
              .map((g) => (
              <div
                key={g.id}
                className={`chat-list-item ${activeGroup?.id === g.id ? "active" : ""}`}
                onClick={() => setActiveGroup(g)}
              >
                <div
                  className="avatar-badge"
                  style={g.displayPhotoURL ? { backgroundImage: `url(${g.displayPhotoURL})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
                >
                  {!g.displayPhotoURL && groupLabel(g)?.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="chat-list-name">
                    {groupLabel(g)} {g.isDefault && "📢"}
                  </div>
                  <div className="chat-list-preview">
                    {g.isDefault ? "Admin updates land here" : g.isDM ? "Direct message" : "Tap to open"}
                  </div>
                </div>
              </div>
              ))}
          </div>
        )}

        {tab === "status" && (
          <StatusFeed
            stories={stories}
            myId={profile?.id}
            myPhotoURL={profile?.photoURL}
            myStoryPosted={myStoryPosted}
            onAddStory={() => setShowStoryComposer(true)}
            onView={openStoryGroup}
          />
        )}

        {tab === "people" && <PeopleList authedFetch={authedFetch} onOpenDM={handleOpenDM} />}
      </aside>

      <section className="chat-window">
        {activeGroup ? (
          <>
            <div className="chat-topbar">
              <button className="back-btn" onClick={() => setActiveGroup(null)} title="Back">‹</button>
              <div
                className="avatar-badge"
                style={activeGroup.displayPhotoURL ? { backgroundImage: `url(${activeGroup.displayPhotoURL})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
              >
                {!activeGroup.displayPhotoURL && groupLabel(activeGroup)?.slice(0, 2).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="chat-list-name">{groupLabel(activeGroup)}</div>
                {activeGroup.isDefault && (
                  <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>Only the admin posts here</div>
                )}
              </div>
              {!activeGroup.isDefault && !activeGroup.isDM && (
                <button className="btn-outline" style={{ padding: "6px 14px", fontSize: "0.82rem", flexShrink: 0 }} onClick={() => setShowAddMember(true)}>
                  + Add person
                </button>
              )}
            </div>

            <div className="messages">
              {messages.map((m) => (
                <MessageBubble
                  key={m.id}
                  message={m}
                  isMine={m.senderId === profile?.id}
                  onDelete={() => handleDeleteMessage(m.id)}
                />
              ))}
              <div ref={messagesEndRef} />
            </div>

            <form className="composer" onSubmit={handleSend}>
              {recording ? (
                <div className="voice-recording-bar">
                  <button type="button" className="voice-recording-cancel" onClick={() => stopRecording(true)} title="Discard">
                    🗑️
                  </button>
                  <span className="voice-recording-dot" />
                  <span className="voice-recording-timer">
                    {String(Math.floor(recordingSeconds / 60)).padStart(2, "0")}:
                    {String(recordingSeconds % 60).padStart(2, "0")}
                  </span>
                  <span style={{ flex: 1 }} />
                </div>
              ) : (
                <textarea
                  ref={textareaRef}
                  value={draft}
                  onChange={handleDraftChange}
                  onKeyDown={handleComposerKeyDown}
                  rows={1}
                  placeholder={
                    activeGroup.isDefault && !profile?.isAdmin
                      ? "Only the admin can post here"
                      : `Type a message… (or "${aiName}, ..." to let AI draft it)`
                  }
                  disabled={(activeGroup.isDefault && !profile?.isAdmin) || aiBusy}
                />
              )}

              {recording ? (
                <button
                  type="button"
                  className="btn-accent composer-round-btn"
                  onClick={() => stopRecording(false)}
                  title="Send voice note"
                >
                  ✓
                </button>
              ) : draft.trim() ? (
                <button
                  className="btn-accent composer-round-btn"
                  disabled={(activeGroup.isDefault && !profile?.isAdmin) || aiBusy}
                  title="Send"
                >
                  {aiBusy ? "…" : "➤"}
                </button>
              ) : (
                <button
                  type="button"
                  className="btn-accent composer-round-btn"
                  onClick={startRecording}
                  disabled={(activeGroup.isDefault && !profile?.isAdmin) || aiBusy || sendingVoiceNote}
                  title="Record a voice note"
                >
                  {sendingVoiceNote ? "…" : "🎤"}
                </button>
              )}
            </form>
          </>
        ) : (
          <div style={{ margin: "auto", color: "var(--text-secondary)" }}>Pick a chat to get started.</div>
        )}
      </section>
        </>
      )}

      <nav className="bottom-nav">
        <button className={`bottom-nav-btn ${tab === "chats" ? "active" : ""}`} onClick={() => setTab("chats")}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 10c0-3.3 3.6-6 8-6s8 2.7 8 6-3.6 6-8 6c-.9 0-1.8-.1-2.6-.3L6 19l1.2-4.4C5.2 13.2 4 11.7 4 10z" />
          </svg>
          <span>Chats</span>
        </button>
        <button className={`bottom-nav-btn ${tab === "people" ? "active" : ""}`} onClick={() => setTab("people")}>
          <span style={{ fontSize: "1.2rem", lineHeight: 1 }}>👥</span>
          <span>People</span>
        </button>
        <button className={`bottom-nav-btn ${tab === "feed" ? "active" : ""}`} onClick={() => setTab("feed")}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="M12 3.5C6.5 3.8 3.7 6.4 3.5 12M20.5 8.2C20.2 5.2 17.8 2.9 14.8 2.6M20.5 15.8C20.2 18.8 17.8 21.1 14.8 21.4M3.5 12c.2 5.6 3 8.2 8.5 8.5" />
            <path d="M12 9v6M9 12h6" strokeWidth="2.5" />
          </svg>
          <span>Feed</span>
        </button>
        <button className={`bottom-nav-btn ${tab === "status" ? "active" : ""}`} onClick={() => setTab("status")}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="8.5" />
            <circle cx="12" cy="12" r="8.5" strokeDasharray="4 4" opacity="0.5" />
          </svg>
          <span>Status</span>
        </button>
      </nav>

      {showSideMenu && (
        <SideMenu
          profile={profile}
          tab={tab}
          onClose={() => setShowSideMenu(false)}
          onStatusClick={() => setTab("status")}
          onLogout={logout}
        />
      )}
      {showBrowseGroups && (
        <BrowseGroupsModal authedFetch={authedFetch} onClose={() => setShowBrowseGroups(false)} />
      )}

      {showGroupModal && (
        <GroupModal onClose={() => setShowGroupModal(false)} onCreate={handleCreateGroup} />
      )}
      {showStoryComposer && (
        <StoryComposerModal onClose={() => setShowStoryComposer(false)} onSubmit={handleAddStory} />
      )}
      {viewingStoryGroup && (
        <StoryViewerModal
          stories={viewingStoryGroup.stories}
          startIndex={viewingStoryGroup.startIndex}
          isMine={viewingStoryGroup.isMine}
          authedFetch={authedFetch}
          onClose={() => setViewingStoryGroup(null)}
          onReshare={(story) => setShareStoryTarget(story)}
        />
      )}
      {shareStoryTarget && (
        <ShareToChatModal groups={groups} onClose={() => setShareStoryTarget(null)} onShare={handleReshareStory} />
      )}
      {showAddMember && (
        <AddMemberModal onClose={() => setShowAddMember(false)} onAdd={handleAddMember} />
      )}
      {showQuickApps && <QuickAppsPanel onClose={() => setShowQuickApps(false)} />}
    </div>
  );
}
