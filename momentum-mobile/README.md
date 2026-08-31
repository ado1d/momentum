# Momentum for Android 📱 (v1.3.0 — pro writing & reading upgrade)

The full Momentum productivity app as a **native Android app** — built with Expo (React Native).
It works **100% offline** (everything is stored in the phone's local SQLite database) and can
**sign in with Google** to sync with your Momentum web account.

> **Upgrading from v1.2.1?** This release upgrades the two things you asked for —
> **writing** and **viewing** — to web-app quality:
>
> ### ✍️ The writing section (Notes, Diary, task & goal notes, Quick Add)
> - **Full formatting toolbar** attached to the editor — **undo/redo**, **B** bold,
>   *I* italic, ~~S~~ strikethrough, **H1/H2/H3**, ❝ quote, `code block`,
>   bullet list, 1. numbered list, ☑ **task list**, link, and **[[ ]] wiki-link**
>   (in Notes) — all with **live active-state highlighting** so you always see
>   what's applied at the cursor.
> - **Tap-to-toggle** — tapping an active format REMOVES it (like the web editor).
>   No selection? Tapping **B** bolds the word under the cursor (Telegram-style).
> - **Smart Enter** — pressing Enter inside a list continues it automatically
>   (`- ` → `- `, `1.` → `2.`, `- [ ]` → `- [ ]`). Press Enter on an empty
>   item to exit the list — exactly like the web editor.
> - **Undo & redo** with proper history (typing is coalesced, toolbar steps are atomic).
> - **Word/character count** + a syntax hint under the editor, like the web dialog.
> - **Link insert** pre-selects the URL so you can type or paste over it.
>
> ### 👁️ The reading/viewing experience
> - **Full markdown rendering** in reading views: H1–H4 headings, bold, italic,
>   ~~strikethrough~~, inline code, code fences, quotes, **nested lists**,
>   **task lists with real checkboxes** (☐/☑, done items get struck through),
>   **tappable [links](https://…)** that open an in-app browser, `<u>underline</u>`,
>   rules, and clickable **[[wiki-links]]**.
> - **Note cards show real formatted markdown** (bold headings, checkboxes, lists)
>   instead of flat text — like the web app's previews, with a ~5-line clamp.
> - Web-matching typography: airier paragraphs, sized headings, tighter code blocks.
>
> ### 🕵️ Hidden fixes & polish
> - **Long-press any note card** → Pin / Unpin, Edit, **Export (.md)**, Delete
>   (the web card's ⋯ menu, mobile-style). The card shows a small ⋯ hint.
> - **Export a single note as Markdown** from the reader (share sheet) —
>   same as the web app's export menu.
> - **Unsaved-changes guard** — closing a note editor with edits now asks
>   “Discard changes?” instead of silently throwing your writing away.
> - **Clear (✕) buttons** in the Notes and global Search fields.
> - **Cleaner previews everywhere** — search results and diary entry rows no
>   longer show raw `**markdown**` syntax.
> - **Bug fix:** "New note" after a previous note no longer shows the stale
>   previous content.
> - **Bug fix:** backup export/import used an outdated file-system API that
>   would have failed on this Expo version — now fixed.
>
> Install the new APK **over** the old one (same package name) — your existing data stays.
>
> Everything from v1.2.1 is still there (flush header, reliable icon rendering,
> note tags, reading views, automatic reminders, Google profile name & photo,
> developer contact card in Settings).

Same features as the web app:

| Area | What you get |
| --- | --- |
| **Dashboard** | Greeting + score pill, quote card, 2×2 stat cards (score ring, tasks, habits, streak), this-week chart, overdue banner, today's focus, habit chips with week dots, active goals, recent journal |
| **Tasks** | All/Today/Upcoming/Done tabs, priorities, categories, due dates & times, reminders, repeat rules, checklists (subtasks) |
| **Routine** | Habits with streaks, 7-day history & reminder times + morning/afternoon/evening schedule blocks with a week strip |
| **Goals** | Daily/weekly/monthly goals with progress bars, +/- steppers and categories |
| **Notes** | Colored, pinnable, searchable notes with **tags** (#tag filter chips) and a beautiful **reading view** |
| **Diary** | One entry per day: mood, energy, gratitude, free writing + **reading view** for past entries |
| **Focus** | Pomodoro timer with presets, task linking and session history |
| **Insights** | Task/focus/habit charts, habit consistency, mood distribution, all-time totals |
| **Settings** | Google sign-in & sync, dark/light theme, daily check-in + automatic reminders, JSON backup export/import, developer contact |
| **Everywhere** | Quick Add sheet (Task/Note/Diary), global search, bell menu, toasts, offline-first |

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
├── App.tsx                 # App shell: top bar, bottom tabs, More sheet, Quick Add, toasts
├── app.json                # Expo config (app name, icon, Android package)
├── eas.json                # Build profiles (preview = APK)
├── assets/                 # App icon + splash
└── src/
    ├── db.ts               # SQLite layer — all offline data + sync merge + dashboard stats
    ├── driver.ts           # DB driver bootstrap (native: sync no-op)
    ├── sync.ts             # Background sync engine (last-write-wins)
    ├── auth.ts             # Google sign-in flow
    ├── store.ts            # Global state (zustand), persisted in SQLite
    ├── notifications.ts    # Daily check-in + AUTOMATIC reminders (routine/habits/tasks)
    ├── quick-add.tsx       # Quick Add sheet (Task / Note / Diary)
    ├── toast.tsx           # Sonner-style toast feedback
    ├── theme.ts            # Dark/light palettes (matches the web app) + quotes
    ├── utils.ts            # Dates, streaks, formatting
    ├── components/
    │   ├── ui.tsx          # Buttons, cards, chips, sheets, SVG rings, avatars…
    │   ├── task-editor.tsx # Task create/edit sheet (with reminder options)
    │   ├── mini-md.tsx     # Lightweight markdown renderer (reading views)
    │   └── bell-sheet.tsx  # "What needs you today" notifications menu
    └── screens/            # Dashboard, Tasks, Routine, Goals (tabs)
                            # + Focus, Insights, Notes, Diary, Settings, Search (stack)
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
| Reminder notifications don't fire | Check the phone's battery optimization isn't killing Momentum (common on Xiaomi/Oppo); also make sure notifications are allowed for the app in Android settings |
| Installing the new APK over the old one | Just install it — data is kept (same package name). If Android refuses, uninstall first and re-import a backup (Settings → Export before uninstalling) |

---

Built with ❤️ using Expo + React Native + SQLite. Your data lives on your device first.
