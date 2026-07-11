import { Link } from "react-router-dom";
import { useTheme } from "../context/ThemeContext";

const PRESETS = ["#1F6F54", "#B08D57", "#9C3B3B", "#2B4C7E", "#5B3E8F", "#17231D"];

export default function Admin() {
  const { globalConfig, setGlobalTheme, setAllowOverride } = useTheme();

  return (
    <div className="admin-panel">
      <Link to="/" className="link-text">← Back to chats</Link>
      <h1>Admin</h1>
      <p style={{ color: "#5b6b62" }}>
        Changes here apply to every user of the app.
      </p>

      <h2 style={{ fontSize: "1.05rem", marginTop: 28 }}>App-wide accent color</h2>
      <p style={{ fontSize: "0.85rem", color: "#5b6b62" }}>
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
          <div style={{ fontSize: "0.82rem", color: "#5b6b62" }}>
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

      <p style={{ marginTop: 24, fontSize: "0.82rem", color: "#5b6b62" }}>
        More admin controls (broadcasting update notes to Announcements,
        promoting other admins) are wired up on the backend — hook up
        additional UI here as needed.
      </p>
    </div>
  );
}
