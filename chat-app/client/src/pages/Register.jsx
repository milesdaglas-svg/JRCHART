import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await register(email, password, displayName);
      navigate("/");
    } catch (err) {
      setError(err.message.replace("Firebase: ", ""));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>Create your account</h1>
        <p className="subtitle">You'll be added to Announcements automatically.</p>
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Display name</label>
            <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
          </div>
          <div className="field">
            <label>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="field">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              required
            />
          </div>
          {error && <p className="error-text">{error}</p>}
          <button className="btn-accent" style={{ width: "100%" }} disabled={busy}>
            {busy ? "Creating…" : "Create account"}
          </button>
        </form>
        <p style={{ marginTop: 16, fontSize: "0.85rem" }}>
          Already have an account? <Link to="/login" className="link-text">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
