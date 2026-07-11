import { createContext, useContext, useEffect, useState } from "react";
import { useAuth } from "./AuthContext";

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const { authedFetch, profile, firebaseUser } = useAuth();
  const [globalConfig, setGlobalConfig] = useState({
    themeColor: "#1F6F54",
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
