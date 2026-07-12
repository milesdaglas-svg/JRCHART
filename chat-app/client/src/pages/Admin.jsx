import { Link } from "react-router-dom";
import { useTheme } from "../context/ThemeContext";

const PRESETS = ["#7c5cff", "#4c8bf5", "#2fd9c4", "#e0a12b", "#ef5a63", "#ec4899"];

export default function Admin() {
  const { globalConfig, setGlobalTheme, setAllowOverride } = useTheme();

  return (
    <div className="admin-panel">
      <Link to="/" className="link-text">← Back to chats</Link>
      <h1>Admin</h1>
      <p style={{ color: "var(--text-secondary)" }}>
        Changes here apply to every user of the app.
      </p>

      <h2 style={{ fontSize: "1.05rem", marginTop: 28 }}>App-wide accent color</h2>
      <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
        This sets the default color everyone sees. Pick any color at all —
        not just the presets below.
      </p>
      <div className="color-swatches">
        {PRESETS.map((c) => (
          <div
            key={c}
            className={`swatch ${globalConfig.themeColor === c ? "active" : ""}`}
            style={{ background: c }}
            onClick={() => setGlobalTheme(c)}
          />
        ))}
        {/* Full spectrum picker — literally any color in the world */}
        <input
          type="color"
          value={globalConfig.themeColor}
          onChange={(e) => setGlobalTheme(e.target.value)}
          style={{ width: 40, height: 40, border: "none", background: "none", cursor: "pointer" }}
          title="Pick any custom color"
        />
      </div>

      <div className="toggle-row">
        <div>
          <div style={{ fontWeight: 600 }}>Let users pick their own color</div>
          <div style={{ fontSize: "0.82rem", color: "var(--text-secondary)" }}>
            When on, each person can override the app-wide color with any
            color they like, just for themselves.
          </div>
        </div>
        <input
          type="checkbox"
          checked={!!globalConfig.allowUserThemeOverride}
          onChange={(e) => setAllowOverride(e.target.checked)}
          style={{ width: 20, height: 20 }}
        />
      </div>

      <p style={{ marginTop: 24, fontSize: "0.82rem", color: "var(--text-secondary)" }}>
        More admin controls (broadcasting update notes to Announcements,
        promoting other admins) are wired up on the backend — hook up
        additional UI here as needed.
      </p>
    </div>
  );
}
