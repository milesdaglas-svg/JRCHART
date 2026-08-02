import { useState } from "react";
import { Link } from "react-router-dom";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";

export default function Settings() {
  const { globalConfig, setPersonalTheme } = useTheme();
  const { profile, loadProfile, authedFetch } = useAuth();
  const [aiNameInput, setAiNameInput] = useState(profile?.aiName || "Jarvis");
  const [saved, setSaved] = useState(false);
  const [geminiKeyInput, setGeminiKeyInput] = useState(profile?.geminiApiKey || "");
  const [keySaved, setKeySaved] = useState(false);
const [elevenKeyInput, setElevenKeyInput] = useState(profile?.elevenLabsApiKey || "");
  const [elevenKeySaved, setElevenKeySaved] = useState(false);
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

  async function handleSaveGeminiKey(e) {
    e.preventDefault();
    await authedFetch("/api/users/me/gemini-key", {
      method: "PUT",
      body: JSON.stringify({ geminiApiKey: geminiKeyInput.trim() }),
    });
    await loadProfile();
    setKeySaved(true);
    setTimeout(() => setKeySaved(false), 2000);
  }

  async function handleSaveElevenKey(e) {
    e.preventDefault();
    await authedFetch("/api/users/me/elevenlabs-key", {
      method: "PUT",
      body: JSON.stringify({ elevenLabsApiKey: elevenKeyInput.trim() }),
    });
    await loadProfile();
    setElevenKeySaved(true);
    setTimeout(() => setElevenKeySaved(false), 2000);
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

      <h2 style={{ fontSize: "1.05rem", marginTop: 24 }}>Your Gemini API key</h2>
      <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
        The AI assistant runs on your own free Google Gemini key, not a shared
        one. Grab one at{" "}
        <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">
          aistudio.google.com/apikey
        </a>{" "}
        (no billing card needed) and paste it below. It's stored on your
        account and only ever used for your own requests.
      </p>
      <form onSubmit={handleSaveGeminiKey} style={{ display: "flex", gap: 10, marginBottom: 28 }}>
        <input
          type="password"
          value={geminiKeyInput}
          onChange={(e) => setGeminiKeyInput(e.target.value)}
          placeholder="Paste your Gemini API key"
          style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid var(--parchment-line)", flex: 1 }}
        />
        <button className="btn-accent" type="submit">{keySaved ? "Saved ✓" : "Save"}</button>
      </form>

      <h2 style={{ fontSize: "1.05rem", marginTop: 24 }}>Your assistant's voice</h2>
      <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
        For a natural, human-sounding voice instead of the browser's default,
        get a free key at <a href="https://elevenlabs.io" target="_blank" rel="noreferrer">elevenlabs.io</a> (no card needed) and paste it below.
      </p>
      <form onSubmit={handleSaveElevenKey} style={{ display: "flex", gap: 10, marginBottom: 28 }}>
        <input type="password" value={elevenKeyInput} onChange={(e) => setElevenKeyInput(e.target.value)} placeholder="Paste your ElevenLabs API key" style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid var(--parchment-line)", flex: 1 }} />
        <button className="btn-accent" type="submit">{elevenKeySaved ? "Saved ✓" : "Save"}</button>
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

      <div style={{ marginTop: 40, paddingTop: 20, borderTop: "1px solid var(--border)" }}>
        <Link to="/control" className="link-text" style={{ fontSize: "0.8rem" }}>
          Owner console →
        </Link>
      </div>
    </div>
  );
}
