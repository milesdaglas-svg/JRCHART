import { useEffect, useState } from "react";
import { rootFetch } from "../utils/rootFetch.js";

export default function ControlPanel() {
  const [unlocked, setUnlocked] = useState(!!localStorage.getItem("rootAdminPassword"));
  const [passwordInput, setPasswordInput] = useState("");
  const [error, setError] = useState("");

  const [groups, setGroups] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [warnText, setWarnText] = useState("");
  const [addEmail, setAddEmail] = useState("");
  const [dmTarget, setDmTarget] = useState("");
  const [dmText, setDmText] = useState("");
  const [status, setStatus] = useState("");

  async function loadAll() {
    const [g, u] = await Promise.all([
      rootFetch("/api/root/groups").catch((e) => { setError(e.message); return []; }),
      rootFetch("/api/root/users").catch(() => []),
    ]);
    setGroups(g);
    setUsers(u);
  }

  useEffect(() => {
    if (unlocked) loadAll();
  }, [unlocked]);

  async function handleUnlock(e) {
    e.preventDefault();
    setError("");
    try {
      await rootFetch("/api/root/login", {
        method: "POST",
        body: JSON.stringify({ password: passwordInput }),
      });
      localStorage.setItem("rootAdminPassword", passwordInput);
      setUnlocked(true);
    } catch {
      setError("Wrong password");
    }
  }

  async function handleDeleteGroup(id) {
    if (!confirm("Delete this group and all its messages? This can't be undone.")) return;
    await rootFetch(`/api/root/groups/${id}`, { method: "DELETE" });
    await loadAll();
  }

  async function handleForceAdd(e) {
    e.preventDefault();
    if (!selectedGroup || !addEmail.trim()) return;
    await rootFetch(`/api/root/groups/${selectedGroup}/members`, {
      method: "POST",
      body: JSON.stringify({ email: addEmail.trim() }),
    }).catch((e) => setStatus(e.message));
    setAddEmail("");
    setStatus("Added ✓");
    await loadAll();
  }

  async function handleWarn(e) {
    e.preventDefault();
    if (!selectedGroup || !warnText.trim()) return;
    await rootFetch(`/api/root/groups/${selectedGroup}/message`, {
      method: "POST",
      body: JSON.stringify({ text: warnText.trim(), isWarning: true }),
    });
    setWarnText("");
    setStatus("Warning sent ✓");
  }

  async function handleDM(e) {
    e.preventDefault();
    if (!dmTarget || !dmText.trim()) return;
    await rootFetch("/api/root/dm", {
      method: "POST",
      body: JSON.stringify({ toUid: dmTarget, text: dmText.trim() }),
    });
    setDmText("");
    setStatus("Message sent ✓");
  }

  function handleLogout() {
    localStorage.removeItem("rootAdminPassword");
    setUnlocked(false);
  }

  if (!unlocked) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1>Owner access</h1>
          <p className="subtitle">Enter the admin password to manage the whole app.</p>
          <form onSubmit={handleUnlock}>
            <div className="field">
              <label>Password</label>
              <input
                type="password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                autoFocus
              />
            </div>
            {error && <p className="error-text">{error}</p>}
            <button className="btn-accent" style={{ width: "100%" }}>Enter</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="control-page">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", maxWidth: 720, marginBottom: 20 }}>
        <h1 style={{ margin: 0 }}>Owner console</h1>
        <button className="btn-outline" onClick={handleLogout}>Lock</button>
      </div>

      {status && <p style={{ color: "var(--accent)", maxWidth: 720 }}>{status}</p>}

      <div className="control-section">
        <h2 style={{ fontSize: "1.05rem", marginTop: 0 }}>All groups</h2>
        {groups.map((g) => (
          <div key={g.id} className="control-row">
            <div>
              <div style={{ fontWeight: 600 }}>{g.name} {g.isDefault && "📢"} {g.isDM && "💬"}</div>
              <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>{g.memberCount} member(s)</div>
            </div>
            <button
              className="pill-btn"
              style={{ marginLeft: "auto" }}
              onClick={() => setSelectedGroup(g.id === selectedGroup ? null : g.id)}
            >
              {selectedGroup === g.id ? "Selected" : "Select"}
            </button>
            {!g.isDefault && (
              <button className="btn-danger" onClick={() => handleDeleteGroup(g.id)}>Delete</button>
            )}
          </div>
        ))}
        {groups.length === 0 && <p style={{ color: "var(--text-secondary)" }}>No groups yet.</p>}
      </div>

      <div className="control-section">
        <h2 style={{ fontSize: "1.05rem", marginTop: 0 }}>Force-add a member</h2>
        <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
          Select a group above, then add anyone by email — no invite needed.
        </p>
        <form onSubmit={handleForceAdd} style={{ display: "flex", gap: 10 }}>
          <input
            type="email"
            placeholder="person@example.com"
            value={addEmail}
            onChange={(e) => setAddEmail(e.target.value)}
            style={{ flex: 1, padding: "10px 12px", borderRadius: 8 }}
          />
          <button className="btn-accent" disabled={!selectedGroup}>Add</button>
        </form>
      </div>

      <div className="control-section">
        <h2 style={{ fontSize: "1.05rem", marginTop: 0 }}>Send a warning to that group</h2>
        <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
          Posts a flagged system warning message into the selected group.
        </p>
        <form onSubmit={handleWarn} style={{ display: "flex", gap: 10 }}>
          <input
            placeholder="This group has misleading content…"
            value={warnText}
            onChange={(e) => setWarnText(e.target.value)}
            style={{ flex: 1, padding: "10px 12px", borderRadius: 8 }}
          />
          <button className="btn-accent" disabled={!selectedGroup}>Send</button>
        </form>
      </div>

      <div className="control-section">
        <h2 style={{ fontSize: "1.05rem", marginTop: 0 }}>Message anyone directly</h2>
        <select
          value={dmTarget}
          onChange={(e) => setDmTarget(e.target.value)}
          style={{ width: "100%", padding: "10px 12px", borderRadius: 8, marginBottom: 10, background: "var(--bg-surface)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
        >
          <option value="">Pick a user…</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>{u.displayName} ({u.email})</option>
          ))}
        </select>
        <form onSubmit={handleDM} style={{ display: "flex", gap: 10 }}>
          <input
            placeholder="Your message…"
            value={dmText}
            onChange={(e) => setDmText(e.target.value)}
            style={{ flex: 1, padding: "10px 12px", borderRadius: 8 }}
          />
          <button className="btn-accent" disabled={!dmTarget}>Send</button>
        </form>
      </div>
    </div>
  );
}
