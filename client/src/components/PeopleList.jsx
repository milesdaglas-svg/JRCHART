import { useEffect, useState } from "react";

export default function PeopleList({ authedFetch, onOpenDM }) {
  const [users, setUsers] = useState([]);
  const [requests, setRequests] = useState([]);
  const [busyId, setBusyId] = useState(null);

  async function load() {
    const [u, r] = await Promise.all([
      authedFetch("/api/friends/users").catch(() => []),
      authedFetch("/api/friends/requests").catch(() => []),
    ]);
    setUsers(u);
    setRequests(r);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleAdd(toUid) {
    setBusyId(toUid);
    await authedFetch("/api/friends/request", { method: "POST", body: JSON.stringify({ toUid }) }).catch(() => {});
    await load();
    setBusyId(null);
  }

  async function handleAccept(requestId) {
    setBusyId(requestId);
    const res = await authedFetch(`/api/friends/${requestId}/accept`, { method: "POST" }).catch(() => null);
    await load();
    setBusyId(null);
    if (res?.groupId) onOpenDM(res.groupId);
  }

  async function handleDecline(requestId) {
    setBusyId(requestId);
    await authedFetch(`/api/friends/${requestId}/decline`, { method: "POST" }).catch(() => {});
    await load();
    setBusyId(null);
  }

  async function handleMessage(user) {
    // Friends already have a DM group — accept flow returns it, but for an
    // existing friend we just need to re-run accept-equivalent lookup via /api/friends
    const friends = await authedFetch("/api/friends").catch(() => []);
    const match = friends.find((f) => f.id === user.id);
    if (match) onOpenDM(match.groupId);
  }

  return (
    <div className="scroll-panel">
      {requests.length > 0 && (
        <>
          <div className="list-section-label">Friend requests</div>
          {requests.map((r) => (
            <div key={r.id} className="person-row">
              <div className="avatar-badge">{r.fromName?.slice(0, 2).toUpperCase()}</div>
              <div>
                <div className="person-name">{r.fromName}</div>
                <div className="person-sub">wants to be friends</div>
              </div>
              <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                <button className="pill-btn accent" disabled={busyId === r.id} onClick={() => handleAccept(r.id)}>
                  Accept
                </button>
                <button className="pill-btn" disabled={busyId === r.id} onClick={() => handleDecline(r.id)}>
                  Decline
                </button>
              </div>
            </div>
          ))}
        </>
      )}

      <div className="list-section-label">Everyone on ChatApp</div>
      {users.map((u) => (
        <div key={u.id} className="person-row">
          <div className="avatar-badge">{u.displayName?.slice(0, 2).toUpperCase()}</div>
          <div>
            <div className="person-name">{u.displayName}</div>
            <div className="person-sub">{u.email}</div>
          </div>
          {u.relationship === "friends" && (
            <button className="pill-btn accent" onClick={() => handleMessage(u)}>
              Message
            </button>
          )}
          {u.relationship === "none" && (
            <button className="pill-btn" disabled={busyId === u.id} onClick={() => handleAdd(u.id)}>
              Add friend
            </button>
          )}
          {u.relationship === "pending_sent" && (
            <button className="pill-btn" disabled>Requested</button>
          )}
          {u.relationship === "pending_received" && (
            <span className="person-sub" style={{ marginLeft: "auto" }}>Check requests above ↑</span>
          )}
        </div>
      ))}
      {users.length === 0 && (
        <p style={{ padding: 16, color: "var(--text-secondary)", fontSize: "0.85rem" }}>
          No one else has joined yet.
        </p>
      )}
    </div>
  );
}
