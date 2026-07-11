import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { useAuth } from "../context/AuthContext";
import { API_URL, auth } from "../firebase";
import MessageBubble from "../components/MessageBubble.jsx";
import GroupModal from "../components/GroupModal.jsx";
import AddMemberModal from "../components/AddMemberModal.jsx";
import StoryComposerModal from "../components/StoryComposerModal.jsx";
import StoryViewerModal from "../components/StoryViewerModal.jsx";
import QuickAppsPanel from "../components/QuickAppsPanel.jsx";
import VoiceAssistant from "../components/VoiceAssistant.jsx";
import { uploadStoryMedia } from "../utils/uploadStoryMedia.js";
import { Link } from "react-router-dom";

export default function Home() {
  const { profile, authedFetch, logout } = useAuth();
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

  // --- initial load: groups + stories, and connect the socket ---
  useEffect(() => {
    (async () => {
      const g = await authedFetch("/api/groups").catch(() => []);
      setGroups(g);
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
    })();

    return () => socketRef.current?.disconnect();
  }, []);

  // --- join the socket room whenever the active chat changes ---
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

  // Posts a plain message to any group by id, then broadcasts it over the
  // socket. Shared by the composer and the voice assistant's hands-free sends.
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

    // In-chat AI trigger: typing the assistant's name drafts and sends a
    // reply for the user instead of sending the literal typed text.
    // e.g. "Jarvis, tell her I'm running 10 minutes late"
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
    const g = await authedFetch("/api/groups").catch(() => []);
    setGroups(g);
    setActiveGroup(g.find((x) => x.id === id) || g[0]);
  }

  async function handleAddStory({ text, file }) {
    let mediaUrl = null;
    if (file) {
      mediaUrl = await uploadStoryMedia(profile.id, file);
    }
    await authedFetch("/api/stories", {
      method: "POST",
      body: JSON.stringify({ text: text || null, mediaUrl }),
    });
    const s = await authedFetch("/api/stories").catch(() => []);
    setStories(s);
  }

  const myStoryPosted = stories.some((s) => s.userId === profile?.id);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-header">
          <span className="brand">Chat<span className="brand-mark">App</span></span>
          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={() => setShowQuickApps(true)}
              style={{ background: "none", border: "none", color: "#f7f4ea", fontSize: "1.1rem" }}
              title="Quick reply on other apps"
            >
              🔗
            </button>
            <Link to="/settings" style={{ color: "#f7f4ea", fontSize: "1.1rem" }} title="Settings">⚙️</Link>
            {profile?.isAdmin && (
              <Link to="/admin" style={{ color: "#f7f4ea", fontSize: "1.1rem" }} title="Admin">🛠️</Link>
            )}
            <button
              onClick={logout}
              style={{ background: "none", border: "none", color: "#f7f4ea", fontSize: "1.1rem" }}
              title="Log out"
            >
              ⎋
            </button>
          </div>
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
                style={s.mediaUrl ? { backgroundImage: `url(${s.mediaUrl})`, backgroundSize: "cover" } : undefined}
              >
                {!s.mediaUrl && (s.userId || "?").slice(0, 2).toUpperCase()}
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

        <div style={{ padding: "10px 16px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ color: "rgba(247,244,234,0.6)", fontSize: "0.78rem", fontWeight: 600 }}>CHATS</span>
          <button
            onClick={() => setShowGroupModal(true)}
            style={{ background: "none", border: "none", color: "var(--brass)", fontSize: "1.3rem" }}
            title="New group"
          >
            +
          </button>
        </div>

        <div className="chat-list">
          {groups.map((g) => (
            <div
              key={g.id}
              className={`chat-list-item ${activeGroup?.id === g.id ? "active" : ""}`}
              onClick={() => setActiveGroup(g)}
            >
              <div className="avatar-badge">{g.name?.slice(0, 2).toUpperCase()}</div>
              <div>
                <div className="chat-list-name">
                  {g.name} {g.isDefault && "📢"}
                </div>
                <div className="chat-list-preview">
                  {g.isDefault ? "Admin updates land here" : "Tap to open"}
                </div>
              </div>
            </div>
          ))}
        </div>
      </aside>

      <section className="chat-window">
        {activeGroup ? (
          <>
            <div className="chat-topbar">
              <div className="avatar-badge">{activeGroup.name?.slice(0, 2).toUpperCase()}</div>
              <div style={{ flex: 1 }}>
                <div className="chat-list-name" style={{ color: "var(--ink)" }}>{activeGroup.name}</div>
                {activeGroup.isDefault && (
                  <div style={{ fontSize: "0.78rem", color: "#5b6b62" }}>Only the admin posts here</div>
                )}
              </div>
              {!activeGroup.isDefault && (
                <button className="btn-outline" style={{ padding: "6px 14px", fontSize: "0.82rem" }} onClick={() => setShowAddMember(true)}>
                  + Add person
                </button>
              )}
            </div>

            <div className="messages">
              {messages.map((m) => (
                <MessageBubble key={m.id} message={m} isMine={m.senderId === profile?.id} />
              ))}
              <div ref={messagesEndRef} />
            </div>

            <form className="composer" onSubmit={handleSend}>
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
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
                {aiBusy ? `${aiName} is typing…` : "Send"}
              </button>
            </form>
          </>
        ) : (
          <div style={{ margin: "auto", color: "#5b6b62" }}>Pick a chat to get started.</div>
        )}
      </section>

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
