import { createContext, useContext, useEffect, useState } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";
import { auth, API_URL } from "../firebase";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [profile, setProfile] = useState(null); // Firestore user doc (isAdmin, themeColor, etc)
  const [loading, setLoading] = useState(true);

  async function authedFetch(path, options = {}) {
    const token = await auth.currentUser?.getIdToken();
    const res = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...(options.headers || {}),
      },
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `Request failed: ${res.status}`);
    }
    return res.json();
  }

  async function loadProfile() {
    const data = await authedFetch("/api/users/me").catch(() => null);
    setProfile(data);
    return data;
  }

  async function register(email, password, displayName) {
    await createUserWithEmailAndPassword(auth, email, password);
    await authedFetch("/api/users/profile", {
      method: "POST",
      body: JSON.stringify({ displayName }),
    });
    await authedFetch("/api/groups/join-default", { method: "POST" });
    await loadProfile();
  }

  async function login(email, password) {
    await signInWithEmailAndPassword(auth, email, password);
    await loadProfile();
  }

  async function logout() {
    await signOut(auth);
    setProfile(null);
  }

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user) await loadProfile();
      setLoading(false);
    });
    return unsub;
  }, []);

  return (
    <AuthContext.Provider
      value={{ firebaseUser, profile, loading, register, login, logout, authedFetch, loadProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
