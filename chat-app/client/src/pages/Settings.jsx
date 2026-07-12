import { useState } from "react";
import { Link } from "react-router-dom";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";

export default function Settings() {
  const { globalConfig, setPersonalTheme } = useTheme();
  const { profile, loadProfile, authedFetch } = useAuth();
  const [aiNameInput, setAiNameInput] = useState(profile?.aiName || "Jarvis");
  const [saved, setSaved] = useState(false);

  async function handlePick(e) {
    await setPersonalTheme(e.target.value);
    await loadProfile();
  }

  async function handleSaveAiName(e) {
    e.preventDefault();
    if (!aiNameInput.trim()) return;
    await authedFetch("/api/users/me/ai-name", {
      method: "PUT",
      body: JSON.stringify({ aiName: aiNameInput.trim() }),
    });
    await loadProfile();
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="admin-panel">
      <Link to="/" className="link-text">← Back to chats</Link>
      <h1>Settings</h1>

      <h2 style={{ fontSize: "1.05rem", marginTop: 24 }}>Your AI assistant's name</h2>
      <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
        This is the wake word ("hey {aiNameInput}") and what you type in a
        chat to have it draft a reply for you (e.g. "{aiNameInput}, tell her
        I'm on my way").
      </p>
      <form onSubmit={handleSaveAiName} style={{ display: "flex", gap: 10, marginBottom: 28 }}>
        <input
          value={aiNameInput}
          onChange={(e) => setAiNameInput(e.target.value)}
          style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid var(--parchment-line)", flex: 1 }}
        />
        <button className="btn-accent" type="submit">{saved ? "Saved ✓" : "Save"}</button>
      </form>

      <h2 style={{ fontSize: "1.05rem", marginTop: 24 }}>Your color</h2>
      {globalConfig.allowUserThemeOverride ? (
        <>
          <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
            The admin has enabled custom colors. Pick any color in the world —
            just for your view.
          </p>
          <input
            type="color"
            value={profile?.themeColor || globalConfig.themeColor}
            onChange={handlePick}
            style={{ width: 48, height: 48, border: "none", background: "none", cursor: "pointer" }}
          />
        </>
      ) : (
        <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
          The admin has kept a single app-wide color for now, so personal
          color changes are turned off.
        </p>
      )}
    </div>
  );
}
