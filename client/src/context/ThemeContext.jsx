import { createContext, useContext, useEffect, useState } from "react";
import { useAuth } from "./AuthContext";

const ThemeContext = createContext(null);

// Converts a hex color (any color the admin picks) to an "r, g, b" string so
// CSS can build rgba() glows/shadows from it regardless of which color it is.
function hexToRgbString(hex) {
  const clean = (hex || "#7c5cff").replace("#", "");
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const num = parseInt(full, 16);
  if (Number.isNaN(num)) return "124, 92, 255";
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `${r}, ${g}, ${b}`;
}

export function ThemeProvider({ children }) {
  const { authedFetch, profile, firebaseUser } = useAuth();
  const [globalConfig, setGlobalConfig] = useState({
    themeColor: "#7c5cff",
    allowUserThemeOverride: false,
  });

  async function refreshConfig() {
    const data = await authedFetch("/api/admin/config").catch(() => null);
    if (data) setGlobalConfig(data);
  }

  useEffect(() => {
    if (firebaseUser) refreshConfig();
  }, [firebaseUser]);

  const activeColor =
    globalConfig.allowUserThemeOverride && profile?.themeColor
      ? profile.themeColor
      : globalConfig.themeColor;

  useEffect(() => {
    document.documentElement.style.setProperty("--accent", activeColor);
    document.documentElement.style.setProperty("--accent-rgb", hexToRgbString(activeColor));
  }, [activeColor]);

  async function setPersonalTheme(color) {
    await authedFetch("/api/users/me/theme", {
      method: "PUT",
      body: JSON.stringify({ themeColor: color }),
    });
  }

  async function setGlobalTheme(color) {
    await authedFetch("/api/admin/config", {
      method: "PUT",
      body: JSON.stringify({ themeColor: color }),
    });
    await refreshConfig();
  }

  async function setAllowOverride(allow) {
    await authedFetch("/api/admin/config", {
      method: "PUT",
      body: JSON.stringify({ allowUserThemeOverride: allow }),
    });
    await refreshConfig();
  }

  return (
    <ThemeContext.Provider
      value={{ globalConfig, activeColor, setPersonalTheme, setGlobalTheme, setAllowOverride, refreshConfig }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
