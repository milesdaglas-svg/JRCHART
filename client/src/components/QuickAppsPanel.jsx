const QUICK_APPS = [
  { name: "WhatsApp", icon: "🟢", url: "https://web.whatsapp.com" },
  { name: "Messenger", icon: "🔵", url: "https://www.messenger.com" },
  { name: "Instagram", icon: "🟣", url: "https://www.instagram.com/direct/inbox" },
  { name: "Telegram", icon: "🔷", url: "https://web.telegram.org" },
  { name: "X (Twitter)", icon: "⚫", url: "https://twitter.com/messages" },
  { name: "Gmail", icon: "🔴", url: "https://mail.google.com" },
];

// Opens the other app's own web client in a small floating popup window,
// positioned over the corner of the screen, so this app stays open and
// running behind it instead of a full tab/app switch.
//
// Honest limitation: these platforms don't expose APIs that let a
// third-party app read or send their messages directly, so this is the
// closest real equivalent — one click into their own reply screen, not a
// true embedded reply. True in-app replying would require each platform's
// own official API where one exists (e.g. Instagram's Graph API for
// business accounts), which is a separate integration per platform.
function openQuickApp(url) {
  const width = 420;
  const height = 640;
  const left = window.screen.width - width - 40;
  const top = window.screen.height - height - 80;
  window.open(
    url,
    "_blank",
    `width=${width},height=${height},left=${left},top=${top},noopener,noreferrer`
  );
}

export default function QuickAppsPanel({ onClose }) {
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
      <div className="auth-card" style={{ width: 320 }} onClick={(e) => e.stopPropagation()}>
        <h1 style={{ fontSize: "1.15rem" }}>Quick reply elsewhere</h1>
        <p className="subtitle">
          Opens their reply screen in a small floating window — this app stays
          open behind it.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {QUICK_APPS.map((app) => (
            <button
              key={app.name}
              className="btn-outline"
              style={{ display: "flex", alignItems: "center", gap: 10, textAlign: "left" }}
              onClick={() => openQuickApp(app.url)}
            >
              <span style={{ fontSize: "1.1rem" }}>{app.icon}</span> {app.name}
            </button>
          ))}
        </div>
        <button className="btn-accent" style={{ width: "100%", marginTop: 14 }} onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
