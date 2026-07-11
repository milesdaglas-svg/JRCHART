# ChatApp (working name) — WhatsApp-style app w/ Stories, Admin Theming & AI

A chat app scaffold: accounts, 1:1 & group messaging, 24hr Stories, an
admin-controlled global theme, and a default "Announcements" group every
new user is auto-joined to (admin-only posting, used for app update news).

**Phase 1** (core app), **Phase 2** (AI assistant + Stories media), the
**cross-app quick-reply panel**, **chat history loading**, and **group
member management** are all built. This is the complete app.

### Latest fixes
- **Chat history now loads.** Opening a chat pulls its last 50 messages from
  Firestore before live updates attach — previously you only saw messages
  sent after you opened the window. This was the one real blocker before
  deploying; it's resolved.
- **Add people to your groups.** The chat topbar has a "+ Add person" button
  (hidden on Announcements, since everyone joins that automatically) — type
  an email, and if that person has an account, they're added instantly.

### Cross-app quick reply
- The 🔗 icon in the sidebar opens a panel with one-tap buttons for
  WhatsApp, Messenger, Instagram, Telegram, X, and Gmail.
- Each one opens that platform's own web client in a small floating popup
  window positioned in the corner of the screen — this app keeps running
  behind it, so it's the closest real equivalent to "reply without fully
  switching away."
- **Honest limitation**: none of these platforms let a third-party app read
  or send their messages directly — that's blocked on their end for privacy/
  security, not something any app can code around. True embedded replying
  would require each platform's own official API where one exists (e.g.
  Instagram's Graph API, business accounts only) — a separate integration
  per platform, worth doing later if this becomes a priority.

### Phase 2 additions
- **Stories now support photo uploads** (Firebase Storage), not just text.
- **In-chat AI trigger**: type your assistant's name at the start of a
  message (e.g. `Jarvis, tell her I'm running late`) and it drafts + sends a
  contextual reply for you, using Claude and that chat's recent history.
- **Wake-word voice assistant**: toggle it on in the sidebar, say
  `"hey <yourAiName>"`, then speak a command like `"reply to Lisa saying I'm
  on my way"` — it figures out which chat and sends it, hands-free. Needs
  Chrome or Edge (Web Speech API) and mic permission.
- Set your assistant's name in **Settings** (defaults to "Jarvis").

---

## Stack

- **Backend:** Node.js + Express + Socket.io (real-time messaging)
- **Auth + Database:** Firebase (Auth + Firestore)
- **Frontend:** React (Vite)
- **Deploy target:** Render (web service for server, static site for client)
- **CI:** GitHub Actions (build check on push; later used to package the APK)

---

## Project structure

```
chat-app/
├── server/                # Express + Socket.io API
│   ├── index.js
│   ├── firebaseAdmin.js
│   ├── routes/
│   │   ├── groups.js
│   │   ├── stories.js
│   │   └── admin.js
│   ├── socket/
│   │   └── chatSocket.js
│   ├── package.json
│   └── .env.example
├── client/                # React (Vite) frontend
│   ├── src/
│   │   ├── firebase.js
│   │   ├── context/AuthContext.jsx
│   │   ├── context/ThemeContext.jsx
│   │   ├── pages/ (Login, Register, ChatList, ChatWindow, Stories, Admin, Settings)
│   │   └── components/ (Sidebar, StoryBar, MessageBubble, GroupModal)
│   ├── index.html
│   └── package.json
├── render.yaml            # One-click Render blueprint (server + client)
└── .github/workflows/ci.yml
```

---

## 1. Firebase setup (do this first)

1. Go to https://console.firebase.google.com → **Create project**.
2. Inside the project: **Build → Authentication → Get started → Enable "Email/Password"**.
3. **Build → Firestore Database → Create database** (start in test mode for now — we'll lock it down with rules before going live).
4. **Project settings → General → Your apps → Web app (</> icon)** → register an app, copy the `firebaseConfig` object. That goes into `client/src/firebase.js`.
5. **Project settings → Service accounts → Generate new private key**. This downloads a JSON file — that's what the *server* uses (Firebase Admin SDK) to verify users and enforce admin-only actions. Keep it secret, never commit it.
6. **Build → Storage → Get started** (needed for story photo uploads). Start in test mode for now, same as Firestore.

### Anthropic API key (powers the AI assistant)

Get a key from https://console.anthropic.com and put it in `server/.env` as
`ANTHROPIC_API_KEY`. This is what drives both the in-chat "type the AI's name"
trigger and the voice assistant's command understanding.

### Firestore collections this app uses
- `users/{uid}` → `{ displayName, email, isAdmin, themeColor, createdAt }`
- `groups/{groupId}` → `{ name, isDefault, members: [uid...], createdBy }`
- `groups/{groupId}/messages/{messageId}` → `{ senderId, text, createdAt }`
- `stories/{storyId}` → `{ userId, mediaUrl or text, createdAt, expiresAt }`
- `appConfig/global` → `{ themeColor, allowUserThemeOverride }`  ← this is what your admin panel edits

---

## 2. Local setup

```bash
# server
cd server
cp .env.example .env      # then paste your Firebase service account values in
npm install
npm run dev                # http://localhost:5000

# client (separate terminal)
cd client
npm install
npm run dev                # http://localhost:5173
```

## 3. Deploy (GitHub → Render)

1. Push this repo to GitHub.
2. On Render: **New → Blueprint** → connect the repo → Render reads `render.yaml`
   and creates both services (API + static client) automatically.
3. Add your Firebase service account env vars in the Render dashboard for the
   server service (same names as `.env.example`).
4. Add your Firebase web config as env vars for the client build (see
   `client/.env.example`).

Once this is live and confirmed working, next phase turns this into an APK
via GitHub Actions (Capacitor/Cordova wrapping the same React build), and we
layer in: the AI assistant (in-chat `@ai` trigger + wake-word voice mode) and
the cross-app quick-reply panel.

---

## What's intentionally NOT built yet

- Push notifications, message history pagination (currently loads the last
  50 messages only), file/video messages in regular chats, message search,
  read receipts, removing/promoting group members — polish-pass items once
  you've used the core app for a while and know which ones matter most.
- Turning this into an APK via GitHub Actions (Capacitor) — natural next
  step once you've used the web version and are happy with it.
- A true embedded reply into other platforms (see the cross-app quick-reply
  note above) — the popup-window version is what's realistically possible
  without each platform's own official API.
