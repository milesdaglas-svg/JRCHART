import { Link } from "react-router-dom";

export default function SideMenu({ profile, onClose, onStatusClick, onLogout, tab }) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        zIndex: 60,
        display: "flex",
      }}
      onClick={onClose}
    >
      <div className="side-menu-drawer" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 22 }}>
          <div
            className="avatar-badge"
            style={{
              width: 42,
              height: 42,
              fontSize: "0.85rem",
              ...(profile?.photoURL ? { backgroundImage: `url(${profile.photoURL})`, backgroundSize: "cover", backgroundPosition: "center" } : {}),
            }}
          >
            {!profile?.photoURL && (profile?.displayName?.slice(0, 2).toUpperCase() || "U")}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: "0.9rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {profile?.displayName || "You"}
            </div>
            <Link to="/account" className="side-menu-sublink" onClick={onClose}>
              View account
            </Link>
          </div>
        </div>

        <button
          className={`side-menu-item ${tab === "status" ? "active" : ""}`}
          onClick={() => {
            onStatusClick();
            onClose();
          }}
        >
          ⭐ Status
        </button>
        <Link to="/account" className="side-menu-item" onClick={onClose}>
          👤 Account
        </Link>
        <Link to="/settings" className="side-menu-item" onClick={onClose}>
          ⚙️ Settings
        </Link>
        {profile?.isAdmin && (
          <Link to="/admin" className="side-menu-item" onClick={onClose}>
            🛠️ Admin
          </Link>
        )}

        <div style={{ flex: 1 }} />

        <button
          className="side-menu-item"
          onClick={() => {
            onLogout();
            onClose();
          }}
        >
          ⎋ Log out
        </button>
      </div>
    </div>
  );
}
