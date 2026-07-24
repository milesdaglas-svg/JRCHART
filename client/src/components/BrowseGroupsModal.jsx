import { useEffect, useState } from "react";

export default function BrowseGroupsModal({ authedFetch, onClose }) {
  const [view, setView] = useState("discover"); // discover | requests
  const [groups, setGroups] = useState([]);
  const [requests, setRequests] = useState([]);
  const [busyId, setBusyId] = useState(null);

  async function loadDiscover() {
    const g = await authedFetch("/api/groups/discover").catch(() => []);
    setGroups(g);
  }

  async function loadRequests() {
    const r = await authedFetch("/api/groups/join-requests").catch(() => []);
    setRequests(r);
  }

  useEffect(() => {
    loadDiscover();
    loadRequests();
  }, []);

  async function handleRequestJoin(groupId) {
    setBusyId(groupId);
    await authedFetch(`/api/groups/${groupId}/request-join`, { method: "POST" }).catch(() => {});
    await loadDiscover();
    setBusyId(null);
  }

  async function handleApprove(reqId) {
    setBusyId(reqId);
    await authedFetch(`/api/groups/join-requests/${reqId}/approve`, { method: "POST" }).catch(() => {});
    await loadRequests();
    setBusyId(null);
  }

  async function handleDecline(reqId) {
    setBusyId(reqId);
    await authedFetch(`/api/groups/join-requests/${reqId}/decline`, { method: "POST" }).catch(() => {});
    await loadRequests();
    setBusyId(null);
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 50,
      }}
      onClick={onClose}
    >
      <div
        className="auth-card"
        style={{ width: 360, maxHeight: "70vh", overflow: "hidden", display: "flex", flexDirection: "column" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h1 style={{ fontSize: "1.2rem" }}>Groups</h1>
        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <button className={`pill-btn ${view === "discover" ? "accent" : ""}`} onClick={() => setView("discover")}>
            Discover
          </button>
          <button className={`pill-btn ${view === "requests" ? "accent" : ""}`} onClick={() => setView("requests")}>
            Requests {requests.length > 0 && `(${requests.length})`}
          </button>
        </div>

        <div style={{ overflowY: "auto", flex: 1 }}>
          {view === "discover" && (
            <>
              {groups.map((g) => (
                <div key={g.id} className="person-row">
                  <div className="avatar-badge">{g.name?.slice(0, 2).toUpperCase()}</div>
                  <div>
                    <div className="person-name">{g.name}</div>
                    <div className="person-sub">
                      {g.memberCount} member{g.memberCount === 1 ? "" : "s"}
                    </div>
                  </div>
                  {g.requested ? (
                    <button className="pill-btn" disabled style={{ marginLeft: "auto" }}>
                      Requested
                    </button>
                  ) : (
                    <button
                      className="pill-btn accent"
                      style={{ marginLeft: "auto" }}
                      disabled={busyId === g.id}
                      onClick={() => handleRequestJoin(g.id)}
                    >
                      Request to join
                    </button>
                  )}
                </div>
              ))}
              {groups.length === 0 && (
                <p style={{ padding: 16, color: "var(--text-secondary)", fontSize: "0.85rem" }}>
                  No other groups to discover yet.
                </p>
              )}
            </>
          )}

          {view === "requests" && (
            <>
              {requests.map((r) => (
                <div key={r.id} className="person-row">
                  <div className="avatar-badge">{r.displayName?.slice(0, 2).toUpperCase()}</div>
                  <div>
                    <div className="person-name">{r.displayName}</div>
                    <div className="person-sub">wants to join {r.groupName}</div>
                  </div>
                  <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                    <button className="pill-btn accent" disabled={busyId === r.id} onClick={() => handleApprove(r.id)}>
                      Approve
                    </button>
                    <button className="pill-btn" disabled={busyId === r.id} onClick={() => handleDecline(r.id)}>
                      Decline
                    </button>
                  </div>
                </div>
              ))}
              {requests.length === 0 && (
                <p style={{ padding: 16, color: "var(--text-secondary)", fontSize: "0.85rem" }}>
                  No pending requests for your groups.
                </p>
              )}
            </>
          )}
        </div>

        <button className="btn-outline" style={{ marginTop: 10 }} onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}