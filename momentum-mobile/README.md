# Momentum for Android 📱

The full Momentum productivity app as a **native Android app** — built with Expo (React Native).
It works **100% offline** (everything is stored in the phone's local SQLite database) and can
**sign in with Google** to sync with your Momentum web account.

Same features as the web app:

| Area | What you get |
| --- | --- |
| **Dashboard** | Today's progress ring, habits row, overdue + today's tasks, focus stats |
| **Tasks** | Priorities, categories, due dates & times, repeat rules, checklists (subtasks) |
| **Routine** | Habits with streaks & 7-day history + morning/afternoon/evening schedule blocks |
| **Goals** | Daily/weekly/monthly goals with progress bars and categories |
| **Notes** | Colored, pinnable, searchable notes |
| **Diary** | One entry per day: mood, energy, gratitude, free writing, recent-entries timeline |
| **Focus** | Pomodoro timer with presets, task linking and session history |
| **Insights** | Task/focus/habit charts, mood distribution, all-time totals |
| **Settings** | Google sign-in & sync, dark/light theme, daily reminder, JSON backup export/import |

---

## 🚀 Quick start (5 minutes, no Android Studio needed)

### 0. Prerequisites

- **Node.js 18+** installed → check with `node -v` (get it from https://nodejs.org)
- **VS Code** with the folder opened
- An Android phone (to install the final app)

### 1. Install dependencies

Open a terminal in VS Code (`Ctrl+~`) inside this folder and run:

```bash
npm install
```

> ⚠️ If you ever see version mismatch errors, run `npx expo install --fix` and retry.

### 2. Try it instantly on your phone (optional but fun)

Install the **Expo Go** app from the Play Store, then run:

```bash
npx expo start
```

Scan the QR code with Expo Go (Android) and the app opens on your phone.
Everything already works offline here — add tasks, habits, notes, journal entries.

### 3. Build the installable APK

The easiest way is **EAS Build** (Expo's free cloud build — you don't need
Android Studio or any Android SDK on your computer):

```bash
npm install -g eas-cli
eas login          # create a free account at https://expo.dev if you don't have one
eas build -p android --profile preview
```

- The build takes ~10 minutes in the cloud.
- When it finishes you get a **download link** — open it on your phone and install the APK
  (allow "install from unknown sources" when Android asks).
- That's it: a real Momentum app on your home screen that works fully offline. 🎉

<details>
<summary><b>Alternative: build locally with Android Studio (no Expo account)</b></summary>

1. Install Android Studio + Android SDK (https://developer.android.com/studio)
2. Run:
   ```bash
   npx expo run:android
   ```
   (with your phone connected via USB debugging, or an emulator running)
3. The compiled APK also lands in `android/app/build/outputs/apk/` — you can share that file directly.
</details>

---

## 🔑 Google sign-in & sync with your web account

Google login works out of the box once you add **one redirect URI** in Google Cloud Console
(the app rides on the same Google OAuth client your Momentum web app already uses):

1. Go to https://console.cloud.google.com/apis/credentials
2. Open the **OAuth 2.0 Client ID** of type **Web application** that you created for the Momentum web app
3. Under **Authorized redirect URIs**, add:

   ```
   https://momentum-theta-navy.vercel.app/api/mobile/auth/google
   ```

4. Save. Done — no keys, no SHA-1 fingerprints, nothing to paste into the app.

Now open the Android app → **More → Settings → Continue with Google**. Your account signs in
and the app syncs **both ways** with the web app (same tasks, habits, notes, diary, goals and
focus sessions — last change wins).

> **Note:** sign-in requires internet (obviously), but the app itself keeps working fully
> offline — changes made offline are queued and synced automatically next time you're online.

> **Note:** Google sign-in works in the **built APK** and in a **development build**. Inside
> Expo Go it will try to return via `exp://` (works on many devices, but the APK is the
> supported path).

### How sync works

- Everything you do lands in the local SQLite database instantly — offline, airplane mode, whatever.
- If you're signed in, changes sync to your web account in the background (on app open, when
  connectivity returns, and a few seconds after each change).
- Deletes sync too (tombstones), so deleting a task on your phone removes it on the web app and vice versa.
- Don't want an account? Skip sign-in — the app never requires the network.

---

## 📁 Project structure

```
momentum-mobile/
├── App.tsx                 # Navigation + theme + connectivity wiring
├── app.json                # Expo config (app name, icon, Android package)
├── eas.json                # Build profiles (preview = APK)
├── assets/                 # App icon + splash
└── src/
    ├── db.ts               # SQLite layer — all offline data + sync merge logic
    ├── sync.ts             # Background sync engine (last-write-wins)
    ├── auth.ts             # Google sign-in flow
    ├── store.ts            # Global state (zustand), persisted in SQLite
    ├── notifications.ts    # Daily reminder
    ├── theme.ts            # Dark/light palettes (matches the web app)
    ├── utils.ts            # Dates, streaks, formatting
    ├── components/
    │   ├── ui.tsx          # Buttons, cards, chips, sheets, rings…
    │   └── task-editor.tsx # Task create/edit sheet
    └── screens/            # Dashboard, Tasks, Focus, Insights, More,
                            # Routine, Goals, Notes, Diary, Settings
```

## 🛠️ Customization

- **Change the app name/package:** edit `app.json` (`name`, `android.package`) before building.
- **Point at your own server:** Settings → Server (default is the production Momentum deployment).
- **Colors:** `src/theme.ts`.

## ❓ Troubleshooting

| Problem | Fix |
| --- | --- |
| `npm install` fails / version conflicts | `npx expo install --fix` then reinstall |
| Metro cache weirdness | `npx expo start -c` |
| Google sign-in returns "not configured" | The redirect URI above isn't added (or GOOGLE_CLIENT_ID/SECRET env vars missing on the server) |
| APK won't install | Allow "install unknown apps" for your browser in Android settings |
| Reminder notifications don't fire | Check the phone's battery optimization isn't killing Momentum (common on Xiaomi/Oppo) |

---

Built with ❤️ using Expo + React Native + SQLite. Your data lives on your device first.
