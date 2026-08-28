# Momentum — Productivity Companion

A local-first, single-page productivity app: tasks, habits, goals, notes, journal, and a Pomodoro focus timer — in one calm interface. Built with Next.js 16 and a local SQLite database. Installable as a PWA and works offline.

![stack](https://img.shields.io/badge/Next.js-16-black) ![stack](https://img.shields.io/badge/TypeScript-strict-blue) ![stack](https://img.shields.io/badge/Prisma-SQLite-teal) ![stack](https://img.shields.io/badge/Tailwind-v4-emerald)

## Features

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
- **Prisma ORM** + **SQLite** (11 models)
- **Zustand** (UI state) + **TanStack Query v5** (server state)
- **zod** validation, **sonner** toasts, **date-fns**, **next-themes**
- Vanilla service worker (no runtime deps) for PWA/offline

## Quick start (local)

> Requires Node 18+ and [Bun](https://bun.sh) (or npm — adjust commands accordingly).

```bash
# 1. install dependencies
bun install

# 2. configure the database URL
cp .env.example .env   # DATABASE_URL="file:../db/custom.db"

# 3. create the SQLite database (fresh schema)
bun run db:push

# 4. start the dev server
bun run dev            # → http://localhost:3000
```

The app ships with empty states everywhere — add your first task with `n`, create habits in Routine, and the dashboard fills in as you go.

### Useful scripts

| Command | Purpose |
|---|---|
| `bun run dev` | Dev server on port 3000 |
| `bun run build` | Production build (standalone output) |
| `bun run start` | Run the production build |
| `bun run lint` | ESLint |
| `bun run db:push` | Push `prisma/schema.prisma` to SQLite |
| `bun run db:generate` | Regenerate the Prisma client |

## Deployment

> ⚠️ **Heads-up: this app uses SQLite via a local file (`db/custom.db`).**
> Vercel (and most serverless platforms) have **ephemeral filesystems** — the database resets on every deployment. Your data is safe locally, but a vanilla Vercel deploy would start empty on each cold start.

You have three options:

### Option A — Self-host (recommended, keeps SQLite as-is)

Deploy on any machine/container with a persistent disk (VPS, Docker, Railway/Fly.io with a volume, home server):

```bash
bun install && bun run build && bun run start
```

Your data lives in `db/custom.db` — back it up with the in-app JSON export (Settings → Export), which can be restored on any instance (Settings → Import & restore).

### Option B — Vercel + Turso (SQLite-compatible, minimal changes)

[Turso](https://turso.tech) is a hosted libSQL database — the closest match to this stack:

1. Change the Prisma datasource to `provider = "sqlite"` with a `libsql:` URL + `@prisma/adapter-libsql` driver adapter (small change in `prisma/schema.prisma` + `src/lib/db.ts`).
2. Add env vars on Vercel: `DATABASE_URL`, `TURSO_AUTH_TOKEN`.
3. `vercel deploy`.

### Option C — Vercel + Postgres (Neon / Vercel Postgres / Supabase)

1. Flip the Prisma provider to `postgresql` and adjust a few column types.
2. Run `prisma migrate dev` against the hosted DB, then `vercel deploy`.

> Note: the PWA service worker (`public/sw.js`) serves the cached app shell offline — this works on any host. A single-user, single-instance topology is assumed (no auth layer).

## Project structure

```
prisma/schema.prisma      # 11 models: Todo, Subtask, Habit, HabitLog,
                          # RoutineTask, RoutineLog, Note, JournalEntry,
                          # Goal, FocusSession, Settings
src/app/api/              # 17 REST route groups (typed, zod-validated)
src/app/page.tsx          # the single route — SPA view switching
src/components/app/       # app shell, command palette, quick add,
                          # review dialog, onboarding, PWA pieces
src/components/app/views/ # 9 views: dashboard, tasks, routine, goals,
                          # notes, diary, insights, focus, settings
src/components/ui/        # shadcn/ui primitives
src/lib/                  # typed API client, date helpers, drag hook,
                          # notifications, markdown, export pipeline
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
