# Momentum — Productivity Companion

A multi-user, single-page productivity app: tasks, habits, goals, notes, journal, and a Pomodoro focus timer — in one calm interface. Sign in with Google; every user's data is isolated in their own workspace. Built with Next.js 16, Neon Postgres, and NextAuth. Installable as a PWA with an offline shell.

![stack](https://img.shields.io/badge/Next.js-16-black) ![stack](https://img.shields.io/badge/TypeScript-strict-3178c6) ![stack](https://img.shields.io/badge/Prisma-Postgres(teal)-teal) ![stack](https://img.shields.io/badge/Tailwind-v4-emerald) ![stack](https://img.shields.io/badge/NextAuth-Google-red)

## Features

**Auth** — Google sign-in (NextAuth v4, JWT sessions), per-user data isolation on every endpoint, avatar menu with sign-out, per-user onboarding tour. Public health probe at `/api/health` (returns the deployed commit sha).

**Dashboard** — daily score, today's focus tasks, habit check-ins, streaks, weekly average, motivational quotes.

**Tasks** — priorities, categories, due dates & reminders, recurring tasks (daily/weekdays/weekly/monthly), subtask checklists with drag-to-reorder, smart overdue grouping.

**Routine** — habit tracker with streaks, time-of-day sections (morning/afternoon/evening), drag-to-reorder, satisfying check animations.

**Goals** — progress tracking with increment buttons, period badges (weekly/monthly/yearly), overall-progress ring, deadline countdown chips, celebration animation at 100%.

**Notes** — markdown editor with formatting toolbar, live preview, pinned notes, tag filtering, and `[[wiki-links]]` between notes with a backlinks panel.

**Diary** — daily journal entries with mood & energy, gratitude field, mood-colored month calendar heatmap, timeline view.

**Focus** — Pomodoro timer (25/5/15), link sessions to specific tasks, session dots, ambient glow while running, recent-sessions history.

**Insights** — weekly/daily stats, and a rich **Weekly Review** dialog (score sparkline, completed tasks, habit check-ins, journal moments) exportable to PDF or Markdown.

**Platform** — command palette (`⌘K`), keyboard shortcuts (`?` for help, `n` for quick add), first-run onboarding tour, dark/light themes, JSON backup export & import, browser notifications for reminders, PWA (installable, offline shell + cached data with offline badge).

## Tech stack

- **Next.js 16** (App Router) + **TypeScript** (strict)
- **Tailwind CSS 4** + **shadcn/ui** (New York style) + Lucide icons
- **Prisma ORM** + **Neon Postgres** (12 models, pooled runtime connection)
- **NextAuth v4** (Google provider, JWT strategy)
- **Zustand** (UI state) + **TanStack Query v5** (server state)
- **zod** validation, **sonner** toasts, **date-fns**, **next-themes**
- Vanilla service worker (no runtime deps) for PWA/offline

## Quick start (local)

> Requires Node 18+ and [Bun](https://bun.sh) (or npm — adjust commands accordingly).

```bash
# 1. install dependencies
bun install

# 2. configure environment (Neon Postgres + Google OAuth)
cp .env.example .env    # fill in DATABASE_URL, DIRECT_URL,
                        # NEXTAUTH_SECRET, GOOGLE_CLIENT_ID/SECRET
#    Google Cloud Console → Credentials → OAuth client:
#    redirect URI http://localhost:3000/api/auth/callback/google

# 3. push the schema to your database
bun run db:push

# 4. start the dev server
bun run dev            # → http://localhost:3000
```

New users start with empty states everywhere — the onboarding tour opens automatically on first sign-in.

### Useful scripts

| Command | Purpose |
|---|---|
| `bun run dev` | Dev server on port 3000 |
| `bun run build` | Production build (standalone output) |
| `bun run start` | Run the production build |
| `bun run lint` | ESLint |
| `bun run db:push` | Push `prisma/schema.prisma` to Postgres (uses `DIRECT_URL`) |
| `bun run db:generate` | Regenerate the Prisma client |

## Deployment

The reference deployment runs on **Vercel + Neon Postgres** (zero-config for this stack):

1. Create a Neon project → copy the pooled and direct connection strings.
2. Import this repo into Vercel (New Project → Import Git Repository).
3. Set env vars on Vercel (Production + Preview):
   - `DATABASE_URL` — Neon **pooled** URL (`…-pooler…neon.tech/…?sslmode=require`)
   - `DIRECT_URL` — Neon **direct** URL (used only by migrations)
   - `NEXTAUTH_URL` — `https://<your-domain>` (production only)
   - `NEXTAUTH_SECRET` — `openssl rand -base64 32`
   - `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — from Google Cloud Console
4. Deploy. In Google Cloud Console add:
   - Authorized JavaScript origin: `https://<your-domain>`
   - Authorized redirect URI: `https://<your-domain>/api/auth/callback/google`

Vercel auto-detects Next.js; `postinstall` runs `prisma generate` automatically. Verify the deploy with `GET /api/health` — it returns the live commit sha (`VERCEL_GIT_COMMIT_SHA`).

> Also works anywhere Node runs (self-host, Docker, Railway, Fly.io): `bun install && bun run build && bun run start` with the same env vars — just point it at any Postgres (Neon, Supabase, RDS…).

## Project structure

```
prisma/schema.prisma      # 12 models: User, Todo, Subtask, Habit, HabitLog,
                          # RoutineTask, RoutineLog, Note, JournalEntry,
                          # Goal, FocusSession, Settings
src/app/api/              # 17 REST route groups (typed, zod-validated,
                          # every handler scoped to the signed-in user)
src/app/api/auth/         # NextAuth (Google) endpoints
src/app/page.tsx          # the single route — SPA view switching
src/components/auth/      # login screen, user menu (avatar + sign-out)
src/components/app/       # app shell, command palette, quick add,
                          # review dialog, onboarding, PWA pieces
src/components/app/views/ # 9 views: dashboard, tasks, routine, goals,
                          # notes, diary, insights, focus, settings
src/components/ui/        # shadcn/ui primitives
src/lib/                  # typed API client, date helpers, drag hook,
                          # notifications, markdown, export pipeline,
                          # server auth (NextAuth options + guards)
public/sw.js              # vanilla service worker (offline shell + cache)
```

## Keyboard shortcuts

| Key | Action |
|---|---|
| `⌘K` / `Ctrl+K` | Command palette |
| `n` | Quick add |
| `?` | Shortcut help |
| `Esc` | Close dialogs |

## License

MIT — do whatever you like, attribution appreciated.
