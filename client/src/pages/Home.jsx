import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { API_URL, auth } from "../firebase";
import MessageBubble from "../components/MessageBubble.jsx";
import GroupModal from "../components/GroupModal.jsx";
import AddMemberModal from "../components/AddMemberModal.jsx";
import StoryComposerModal from "../components/StoryComposerModal.jsx";
import StoryViewerModal from "../components/StoryViewerModal.jsx";
import QuickAppsPanel from "../components/QuickAppsPanel.jsx";
import VoiceAssistant from "../components/VoiceAssistant.jsx";
import PeopleList from "../components/PeopleList.jsx";
import StatusFeed from "../components/StatusFeed.jsx";
import Feed from "../components/Feed.jsx";
import { compressImageToBase64 } from "../utils/compressImage.js";

export default function Home() {
  const { profile, authedFetch, logout } = useAuth();
  const [tab, setTab] = useState("chats"); // chats | status | people
  const [groups, setGroups] = useState([]);
  const [activeGroup, setActiveGroup] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [stories, setStories] = useState([]);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [showStoryComposer, setShowStoryComposer] = useState(false);
  const [viewingStory, setViewingStory] = useState(null);
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
    if (file) mediaBase64 = await compressImageToBase64(file);
    await authedFetch("/api/stories", {
      method: "POST",
      body: JSON.stringify({ text: text || null, mediaBase64 }),
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
      <nav className="icon-rail">
        <div className="brand-dot" title="ChatApp" />
        <button className={`rail-btn ${tab === "chats" ? "active" : ""}`} onClick={() => setTab("chats")} title="Chats">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 10c0-3.3 3.6-6 8-6s8 2.7 8 6-3.6 6-8 6c-.9 0-1.8-.1-2.6-.3L6 19l1.2-4.4C5.2 13.2 4 11.7 4 10z" />
          </svg>
        </button>
        <button className={`rail-btn ${tab === "status" ? "active" : ""}`} onClick={() => setTab("status")} title="Status">⭐</button>
        <button className={`rail-btn ${tab === "people" ? "active" : ""}`} onClick={() => setTab("people")} title="People">👥</button>
        <button className={`rail-btn ${tab === "feed" ? "active" : ""}`} onClick={() => setTab("feed")} title="Posts">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="M12 3.5C6.5 3.8 3.7 6.4 3.5 12M20.5 8.2C20.2 5.2 17.8 2.9 14.8 2.6M20.5 15.8C20.2 18.8 17.8 21.1 14.8 21.4M3.5 12c.2 5.6 3 8.2 8.5 8.5" />
            <path d="M12 9v6M9 12h6" strokeWidth="2.5" />
          </svg>
        </button>
        <div className="rail-spacer" />
        <button className="rail-btn" onClick={() => setShowQuickApps(true)} title="Quick reply elsewhere">🔗</button>
        <Link className="rail-btn" to="/settings" title="Settings">⚙️</Link>
        {profile?.isAdmin && (
          <Link className="rail-btn" to="/admin" title="Admin">🛠️</Link>
        )}
        <button className="rail-btn" onClick={logout} title="Log out">⎋</button>
      </nav>

      {tab === "feed" ? (
        <div style={{ gridColumn: "2 / 4", overflow: "hidden", background: "var(--bg-app)" }}>
          <Feed authedFetch={authedFetch} myId={profile?.id} />
        </div>
      ) : (
        <>
      <aside className="list-panel">
        <div className="list-panel-header">
          <span className="list-panel-title">
            {tab === "chats" ? "Chats" : tab === "status" ? "Status" : "People"}
          </span>
          {tab === "chats" && (
            <button className="icon-btn" onClick={() => setShowGroupModal(true)} title="New group">+</button>
          )}
        </div>

        <div className="story-rail">
          <div className="story-avatar add-story" onClick={() => setShowStoryComposer(true)} title="Add a story">
            {myStoryPosted ? "✓" : "+"}
          </div>
          {stories
            .filter((s) => s.userId !== profile?.id)
            .map((s) => (
              <div
                key={s.id}
                className="story-avatar"
                title={s.text || "Story"}
                onClick={() => setViewingStory(s)}
                style={s.mediaBase64 ? { backgroundImage: `url(${s.mediaBase64})`, backgroundSize: "cover" } : undefined}
              >
                {!s.mediaBase64 && (s.userId || "?").slice(0, 2).toUpperCase()}
              </div>
            ))}
        </div>

        <VoiceAssistant
          aiName={aiName}
          groups={groups}
          activeGroupId={activeGroup?.id}
          authedFetch={authedFetch}
          onExecuteSend={sendMessageToGroup}
        />

        {tab === "chats" && (
          <div className="scroll-panel">
            {groups.map((g) => (
              <div
                key={g.id}
                className={`chat-list-item ${activeGroup?.id === g.id ? "active" : ""}`}
                onClick={() => setActiveGroup(g)}
              >
                <div className="avatar-badge">{groupLabel(g)?.slice(0, 2).toUpperCase()}</div>
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
            myStoryPosted={myStoryPosted}
            onAddStory={() => setShowStoryComposer(true)}
            onView={setViewingStory}
          />
        )}

        {tab === "people" && <PeopleList authedFetch={authedFetch} onOpenDM={handleOpenDM} />}
      </aside>

      <section className="chat-window">
        {activeGroup ? (
          <>
            <div className="chat-topbar">
              <button className="back-btn" onClick={() => setActiveGroup(null)} title="Back">‹</button>
              <div className="avatar-badge">{groupLabel(activeGroup)?.slice(0, 2).toUpperCase()}</div>
              <div style={{ flex: 1 }}>
                <div className="chat-list-name">{groupLabel(activeGroup)}</div>
                {activeGroup.isDefault && (
                  <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>Only the admin posts here</div>
                )}
              </div>
              {!activeGroup.isDefault && !activeGroup.isDM && (
                <button className="btn-outline" style={{ padding: "6px 14px", fontSize: "0.82rem" }} onClick={() => setShowAddMember(true)}>
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
              <button
                className="btn-accent"
                disabled={(activeGroup.isDefault && !profile?.isAdmin) || aiBusy}
              >
                {aiBusy ? `${aiName}…` : "Send"}
              </button>
            </form>
          </>
        ) : (
          <div style={{ margin: "auto", color: "var(--text-secondary)" }}>Pick a chat to get started.</div>
        )}
      </section>
        </>
      )}

      {showGroupModal && (
        <GroupModal onClose={() => setShowGroupModal(false)} onCreate={handleCreateGroup} />
      )}
      {showStoryComposer && (
        <StoryComposerModal onClose={() => setShowStoryComposer(false)} onSubmit={handleAddStory} />
      )}
      {viewingStory && (
        <StoryViewerModal story={viewingStory} onClose={() => setViewingStory(null)} />
      )}
      {showAddMember && (
        <AddMemberModal onClose={() => setShowAddMember(false)} onAdd={handleAddMember} />
      )}
      {showQuickApps && <QuickAppsPanel onClose={() => setShowQuickApps(false)} />}
    </div>
  );
}
