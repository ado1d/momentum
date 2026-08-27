# Momentum — Productivity Companion · Worklog

Project: Next.js 16 (App Router) + TypeScript + Tailwind 4 + shadcn/ui + Prisma (SQLite) + Zustand + TanStack Query + sonner.
Single user-visible route: `/` (SPA with client-side view switching — NO other pages/routes may be created).

---

Task ID: 1
Agent: main
Task: Foundation — schema, theme, libs, app shell, API contract

Work Log:
- Designed Prisma schema (prisma/schema.prisma) with models: Todo, Habit, HabitLog, RoutineTask, RoutineLog, Note, JournalEntry, Goal, Settings. Pushed to SQLite (`bun run db:push`). Local-day keys are `YYYY-MM-DD` strings; timestamps are DateTime.
- Created `src/lib/types.ts` — ALL shared types (Todo, Habit, RoutineTask, Note, JournalEntry, Goal, AppSettings, DashboardStats, ViewId, enums + constant option lists).
- Created `src/lib/dates.ts` — day-key helpers (todayKey, weekStartKey, lastNDays, friendlyDay, formatDueLabel, isOverdue, greeting).
- Created `src/lib/api.ts` — typed fetch client: `todosApi, habitsApi, routineApi, notesApi, journalApi, goalsApi, statsApi, settingsApi, exportApi`. All views MUST use these, not raw fetch.
- Created `src/lib/store.ts` — zustand `useUiStore` (view, quickAddOpen) persisted as `momentum-ui`.
- Created `src/lib/export.ts` — downloadMarkdown/downloadJson/printHtml (PDF via print pipeline) + miniMarkdownToHtml + esc.
- Created `src/lib/notifications.ts` — browser notification engine helpers (computeDueReminders, requestNotificationPermission, showNotification).
- Theme: `src/app/globals.css` — emerald/teal primary (NO indigo/blue), custom scrollbars, `.view-enter` animation, print CSS (`#momentum-print`), safe-area utilities.
- `src/app/layout.tsx` — metadata, viewport (mobile), Providers (next-themes + TanStack Query + sonner Toaster). `public/icon.svg` created.
- App shell (`src/components/app/app-shell.tsx`): desktop sidebar nav + mobile top bar & fixed bottom nav (Home/Tasks/Routine/Goals/More sheet w/ Notes/Diary/Settings), theme toggle, BellMenu (notification center popover), QuickAddDialog (task/note/diary quick capture), NotificationEngine (60s reminder polling).
- `src/app/page.tsx` — mounts AppShell + lazy-loads 7 views from `src/components/app/views/*-view.tsx` (stub files currently exist).
- Shared components in `src/components/app/shared/`: EmptyState, ViewHeader+SectionHeading, ProgressRing+ProgressBar, PriorityBadge/CategoryBadge/habit color maps (badges.tsx), MarkdownContent (lazy react-markdown), WeekDots.
- Nav config: `src/components/app/nav-config.ts` (NAV_ITEMS, MOBILE_PRIMARY_NAV, MOBILE_MORE_NAV).

Stage Summary:
- Foundation complete. Views are stubs. NEXT: backend API routes (Task 2), then views (Tasks 3-a/b/c).

════════════════════════════════════════════════════════════════
API CONTRACT (backend must implement; frontend api.ts already coded):
════════════════════════════════════════════════════════════════
All routes return JSON. Errors: `{ "error": "message" }` + proper status.

- GET  /api/todos?status=active|completed&category=...  → Todo[] (dueDate ASC, priority order urgent>high>medium>low, createdAt DESC; include completed in response when status filter set; "active" = not completed)
- POST /api/todos {title, notes?, priority?, category?, dueDate?(ISO), reminderAt?(ISO)} → Todo
- PATCH /api/todos/:id (partial + {completed?: boolean} — sets completedAt) → Todo
- DELETE /api/todos/:id → {ok:true}
- POST /api/todos/clear-completed → {ok:true} (deletes completed todos)

- GET /api/habits → Habit[] (non-archived, sortOrder ASC; each includes `logs: HabitLog[]` (last 60 days), plus computed `streak` (consecutive days ending today or yesterday), `doneToday`, `completionsThisWeek`)
- POST /api/habits {name, emoji?, color?, timeOfDay?, reminderTime?} → Habit
- PATCH /api/habits/:id (partial + {archived?}) → Habit
- DELETE /api/habits/:id → {ok:true}
- POST /api/habits/:id/toggle {date:"YYYY-MM-DD"} → {done:boolean, streak:number}

- GET /api/routine → RoutineTask[] (non-archived, section morning→afternoon→evening then sortOrder; `doneToday` computed + `streak` computed)
- POST /api/routine {name, emoji?, section?, time?, days?} → RoutineTask
- PATCH /api/routine/:id → RoutineTask
- DELETE /api/routine/:id → {ok:true}
- POST /api/routine/:id/toggle {date} → {done:boolean}

- GET /api/notes → Note[] (pinned first, then updatedAt DESC)
- POST /api/notes {title?, content?, tag?, color?, pinned?} → Note
- PATCH /api/notes/:id → Note
- DELETE /api/notes/:id → {ok:true}

- GET /api/journal?limit=50 → JournalEntry[] (date DESC)
- GET /api/journal/:date (YYYY-MM-DD) → JournalEntry | null
- POST /api/journal {date, title?, content?, mood?, energy?, gratitude?} → JournalEntry (UPSERT by date)
- DELETE /api/journal/:id → {ok:true}

- GET /api/goals?status=&period= → Goal[] (status active first, createdAt DESC; "all" for everything)
- POST /api/goals {title, description?, category?, period?, target?, unit?, startDate?, endDate?} → Goal
- PATCH /api/goals/:id (partial + {progress?, status?}) → Goal (status auto-"completed" when progress>=target)
- POST /api/goals/:id/progress {delta:number} → Goal (clamped 0..target; auto-complete)
- DELETE /api/goals/:id → {ok:true}
- POST /api/goals/reset-period {period} → {ok:true} (sets progress=0 & status="active" for goals of that period)

- GET /api/stats → DashboardStats {
    today:{todosTotal, todosDone, habitsTotal, habitsDone, routineTotal, routineDone, goalsActive, bestStreak, score(0-100), journalWritten, overdueCount},
    week: DayStat[] (last 7 days: {date, todosCompleted, habitsCompleted, routineCompleted, score}),
    activeGoals: Goal[] (top 4 by progress), upcomingTodos: Todo[] (active, dueDate within next 7 days incl today, ≤6 items),
    todayHabits: Habit[] (≤6), recentJournal: JournalEntry[] (≤3),
    quote: {text, author} (rotating motivational quotes picked by day-of-year)
  }
  Score formula (per day): round(50*todosCompleted/max(1,todosTotal) + 30*habitsCompleted/max(1,habitsTotal) + 20*routineCompleted/max(1,routineTotal)) — for "today" include journalWritten as bonus: score = min(100, base + (journalWritten?5:0)).

- GET /api/settings → AppSettings; PATCH /api/settings (partial) → AppSettings (single row id="app", upsert on read)

- GET /api/export?format=markdown|json&scope=all|tasks|routine|notes|journal|goals
  - markdown → text/markdown response (well-structured MD with sections per entity type)
  - json → full backup JSON (all tables + settings)

Validation with zod. Use `import { db } from "@/lib/db"`. Helper `json(data, status)` in route handlers. Date-key strings must be treated as LOCAL day keys (no timezone conversion).

════════════════════════════════════════════════════════════════
FRONTEND VIEW SPEC (for Tasks 3-a/b/c):
════════════════════════════════════════════════════════════════
Views live in src/components/app/views/*. Use:
- `useUiStore` for view switching; `toast` (sonner) for feedback; TanStack Query hooks with the api client in `@/lib/api`.
- Shared components: `@/components/app/shared/*` (EmptyState, ViewHeader, SectionHeading, ProgressRing, ProgressBar, PriorityBadge, CategoryBadge, habitRingStyles/habitDotStyles, MarkdownContent, WeekDots).
- shadcn components from `@/components/ui/*` (button, card, dialog, input, textarea, select, tabs, badge, checkbox, dropdown-menu, popover, sheet, alert-dialog, progress, switch, slider, calendar, separator, skeleton, scroll-area).
- Dates: `@/lib/dates` helpers. Types: `@/lib/types`.
- Export helpers: `@/lib/export` (downloadMarkdown, downloadJson, printHtml, esc, miniMarkdownToHtml); server markdown via `exportApi.markdown(scope)`.
- Mobile-first responsive (bottom nav ~56px + safe area already handled by shell; add pb-24 on mobile content — shell already pads).
- Views must be "use client" and default-export nothing; export named function (DashboardView, TasksView, RoutineView, GoalsView, NotesView, DiaryView, SettingsView).
- DO NOT create new pages/routes. DO NOT modify page.tsx / app-shell.tsx / api.ts (report needed changes in worklog instead).

---
Task ID: 2
Agent: full-stack-developer
Task: Backend — implement all REST API routes under src/app/api/ (todos, habits, routine, notes, journal, goals, stats, settings, export) exactly per the API contract, with zod validation, local day-key semantics, and computed streaks.

Work Log:
- Read worklog.md contract, src/lib/types.ts, src/lib/api.ts, prisma/schema.prisma; verified Prisma client + empty SQLite db and zod v4 API compatibility (partial/extend/coerce/default/refine).
- Created server lib: src/lib/server/http.ts (json helper, HttpError, readJsonBody, parseOrThrow, handleApiError → 400 validation / 404 not found / 500 catch), src/lib/server/daykeys.ts (pure UTC-epoch day-key math: todayKey, isValidDayKey, addDaysToKey, lastNDayKeys, isoWeekdayOfKey, weekStartKeyOf, computeStreak, dayOfYearOfKey — day keys never pass through timezone-shifting Date conversions), src/lib/server/schemas.ts (all shared zod schemas incl. dayKeySchema + isoDateTimeField), src/lib/server/service.ts (getSettings upsert, fetchHabits/RoutineWithLogs, isRoutineDay, serializeTodo/Habit/RoutineTask/Note/JournalEntry/Goal — exact contract shapes with computed streak/doneToday/completionsThisWeek), src/lib/server/export-markdown.ts (markdown builder).
- Implemented all routes with `export const dynamic = "force-dynamic"` and Next.js 16 async `params`:
  - api/todos (GET ?status=active|completed|all&category= with contract ordering: dueDate ASC nulls-last → priority urgent>high>medium>low → createdAt DESC; completed → completedAt DESC; POST), api/todos/[id] (PATCH incl. {completed} setting/clearing completedAt, DELETE), api/todos/clear-completed (POST).
  - api/habits (GET with 60-day logs + computed streak/doneToday/completionsThisWeek — streak computed from ALL logs so it stays exact; POST appends sortOrder), api/habits/[id] (PATCH/DELETE), api/habits/[id]/toggle (POST {date} → {done, streak}).
  - api/routine (GET sections morning→afternoon→evening→anytime then sortOrder, doneToday+streak computed; POST), api/routine/[id], api/routine/[id]/toggle (POST {date} → {done, streak}).
  - api/notes (GET pinned-first then updatedAt DESC; POST), api/notes/[id] (PATCH/DELETE).
  - api/journal (GET ?limit= default 50 date DESC; POST = UPSERT by unique date key — absent fields keep values, explicit null clears), api/journal/[id] (GET: date-key param → entry|null, else by id; DELETE by id), api/journal/date/[date] (GET entry|null, 400 on malformed key).
  - api/goals (GET ?status=&period= — absent/all returns everything ordered active-first then createdAt DESC; POST with defaults period=weekly, status=active, startDate=today), api/goals/[id] (PATCH with progress clamped 0..target + auto-complete / auto-revert logic; DELETE), api/goals/[id]/progress (POST {delta} clamped, auto-complete), api/goals/reset-period (POST {period?} — empty body resets all non-archived goals).
  - api/stats (GET → DashboardStats: today block, 7-day week DayStats oldest→newest, top-4 active goals by progress ratio, ≤6 upcoming todos due within 7 days incl. today, ≤6 todayHabits, ≤3 recentJournal, quote rotating from 15-quote array by day-of-year; score formula exactly per contract with +5 journal bonus capped at 100).
  - api/settings (GET upserts single row id="app" and returns the 5 AppSettings fields; PATCH partial).
  - api/export (GET ?format=markdown|json&scope=… — markdown returns text/markdown with sections per entity; json returns full backup of all tables + settings).
- Deleted the placeholder src/app/api/route.ts (Hello-world stub, not part of the contract).
- `bun run lint` → 0 errors. Curl-verified: todos CRUD + toggle + clear-completed + 400/404 paths, habits toggle/streak (2-day streak ending today), routine toggle, journal upsert (field preservation), goals progress clamping/auto-complete/revert + reset-period, settings GET/PATCH, stats shape + score math (50 base + 5 journal bonus = 55 with test data), markdown + json export. All test rows deleted afterwards — every table back to 0 rows, settings defaults restored.

Stage Summary:
- Backend complete: 20 route files + 5 server-lib modules. All responses match src/lib/types.ts exactly (serializers convert Prisma Date → ISO strings). Frontend api.ts client works unmodified.
- Notes for frontend agents:
  - Semantics chosen where contract was open: todosTotal(day) in stats = todos completed that day + still-active todos that are undated or due on/before that day; routine stats count only tasks scheduled that day (via `days` ISO weekdays), while routine doneToday in list responses = log exists today (per spec); goals default period on create = "weekly"; reset-period with empty body (what api.ts sends) resets ALL non-archived goals.
  - POST /api/todos & friends return 201 on create; errors are always `{ error: string }` with 400/404/500.
  - Journal GET single: /api/journal/{YYYY-MM-DD} works (returns entry or null); /api/journal/date/{YYYY-MM-DD} also exists as an explicit variant.
  - Export scope "routine" includes habits + routine tasks in the markdown; json format always returns the full backup.
- Deviations from contract: none. (Extra: routine toggle also returns `streak` alongside `done` — ToggleResult.streak is optional in types.ts.)

---
Task ID: 3-b
Agent: frontend-developer
Task: Frontend — Routine view (src/components/app/views/routine-view.tsx) + Goals view (src/components/app/views/goals-view.tsx)

Work Log:
- Read worklog contract, types.ts, api.ts, dates.ts, store.ts, all shared components and shadcn primitives first. Replaced only the two stub view files (named exports `RoutineView` / `GoalsView`, both "use client", TanStack Query + typed api client + sonner toasts).
- RoutineView: ViewHeader + date chip + contextual Add button (label follows active tab); Tabs Habits (default) | Schedule; queries ["habits"] + ["routine"].
  - Habits tab: gradient today banner (ProgressRing + "X of Y habits done today" + ProgressBar + microcopy, "Perfect day! 🎉" when all done); habits grouped under Morning ☀️ / Afternoon 🌤️ / Evening 🌙 / Anytime 🕒 headers; cards with emoji in habitRingStyles ring, name, 🔥 streak (hidden at 0), reminderTime chip, WeekDots (last 7 days from logs), kebab (Edit/Delete with AlertDialog), size-11 circular check that fills with habitDotStyles color + zoom-in Check animation; optimistic habitsApi.toggle(id, todayKey()) with rollback; streak toast "🔥 N day streak!" only when the returned streak beats the pre-toggle value. New/Edit habit Dialog: name, 24-emoji picker grid, 6 HABIT_COLORS swatches, TIME_OF_DAY segmented, optional time input. Empty state (Repeat icon) with "Create your first habit" + "Add starter habits" (creates the 3 spec'd starters).
  - Schedule tab: Morning 🌅 / Afternoon ☀️ / Evening 🌙 Cards with "x/y done" + mini ProgressBar; task rows with optimistic circular toggle, emoji, strikethrough when done, time chip, M T W T F S S day-dots dimming non-selected weekdays (parsed from days CSV), Flame streak badge when >1, kebab Edit/Delete; client-side weekday filter (weekdayOfKey) + "+ N blocks not scheduled today" hint + "Nothing scheduled today" panel. New/Edit block Dialog: name, emoji text input w/ preview (default 🌅), section Select, optional time, weekday multi-select chips (default all, ≥1 enforced).
- GoalsView: ViewHeader with Reset dropdown + New goal; query ["goals"] → goalsApi.list({status:"all"}), filtering client-side. Summary strip: Active / Completed (all time) / Completed this week (dateToKey(new Date(updatedAt)) >= weekStartKey(today)). Tabs All|Daily|Weekly|Monthly (segmented control) + Active/Completed/Archived status chips (default Active, re-click clears).
  - GoalCard: category emoji chip, title, period badge (emerald/amber/violet soft), line-clamp description, ProgressBar colored by period, "N / M unit · P%" tabular-nums, due chip (friendlyDay; destructive when overdue), Done badge w/ CircleCheck / Archived muted badge; completed cards emerald-bordered w/ soft bg; size-11 circular Minus/Plus (disabled at 0/target) → optimistic goalsApi.increment(id, ±1) with server status rules mirrored client-side; "🎉 Goal completed!" toast when crossing to target. Kebab: Edit / Mark complete (update {progress: target} + celebration toast) / Archive/Unarchive / Delete (AlertDialog).
  - New/Edit goal Dialog: title, description, category Select (📚/💪/💼/🌿/💰/✨), period segmented with GOAL_PERIODS hints, target (min 1) + unit, start date (default today) + optional end date. Empty state (Target icon) + "Add sample learning goals" (2 spec'd samples). Filtered-empty state with "Clear filters".
- Reset note (deviation from task spec): api.ts has no `resetPeriod(period)` — only `resetPeriodProgress()` which resets ALL non-archived goals. Implemented per-period reset by batching `goalsApi.update(id, {progress: 0})` over goals of the chosen period (server auto-reverts status to active); menu offers daily/weekly/monthly (spec listed daily/weekly — monthly added since GOAL_PERIODS has three).
- All mutations invalidate their own key + ["stats"] (keeps dashboard fresh); optimistic updates with rollback + toast.error(e.message); skeletons while loading, retry card on error; 44px touch targets, focus-visible rings, aria-pressed/aria-label on icon-only controls, rounded-2xl, tabular-nums, no indigo/blue.
- Verified end-to-end with a headless browser (agent-browser): habits starter flow → grouped cards → 3 optimistic toggles → "Perfect day! 🎉"; habit edit/delete via kebab + AlertDialog; schedule block create/toggle; goals sample flow → increment → Mark complete celebration → summary chips (1/1/1) → reset daily w/ confirm → goal edit persisted; mobile 390×844 render check; zero console/page errors. Also curl-verified habits/routine/goals mutation flows (increment clamp/auto-complete, PATCH progress-0 revert). All test data deleted afterwards (habits/routine/goals back to []).
- `bun run lint` → 0 errors; `bunx tsc --noEmit` → 0 errors in the two view files (pre-existing errors in examples/, skills/, src/lib/dates.ts, src/lib/notifications.ts remain — foundation files, not touched).

Stage Summary:
- Routine + Goals views complete and E2E-verified; no changes needed to shared components, api.ts, or types.ts. Remaining stubs: dashboard-view, tasks-view (3-a), notes-view, diary-view, settings-view (3-c).

---
Task ID: 3-a
Agent: frontend-developer
Task: Frontend — Dashboard view + Tasks view (src/components/app/views/dashboard-view.tsx, tasks-view.tsx)

Work Log:
- Read worklog contract, types.ts, api.ts, dates.ts, store.ts, all shared components, shadcn ui components, app-shell/page.tsx; curl-verified /api/stats & /api/todos response shapes before coding.
- dashboard-view.tsx (`DashboardView`, "use client"):
  - Data: useQuery(["stats","dashboard"], statsApi.dashboard). Loading = skeleton layout mirroring the real sections; error = EmptyState retry card; empty-app check (todosTotal=0 && habitsTotal=0 && activeGoals=0 && routineTotal=0) → onboarding card ("Welcome to Momentum 👋", Add first task → setQuickAddOpen(true), Add starter habits → mutation creating the 3 spec'd habits via habitsApi.create then invalidate + toast, Set a goal → setView("goals")) + quote card.
  - Header: greeting() + formatKeyLong(todayKey()) + day-score chip (Zap, {score}%). Quote card with emerald/teal gradient border (p-[1.5px] wrapper) + Sparkles.
  - Stat grid (2 cols mobile / 4 sm+): ProgressRing score card; Tasks today & Habits cards ({done}/{total} + ProgressBar); Best streak card with Flame (orange when >0).
  - "This week": 7 pure-div bars (height = max(4,score)%, today = gradient + highlighted label), title attr tooltips with per-day detail, day-letter labels — no recharts.
  - Overdue banner (destructive-soft, role=alert) when overdueCount>0 → "Review" button setView("tasks").
  - Today's focus: upcomingTodos (≤6) rows — priority dot, animated custom check button, formatDueLabel (red when overdue), optimistic todosApi.update toggle with cache rollback + strike-through transition; "See all" → tasks.
  - Habits today: horizontal scroll chips (emoji, name, check state, WeekDots from habit.logs over lastNDays(7)); tap = optimistic habitsApi.toggle(id, todayKey()); "See all" → routine.
  - Active goals (≤4): cards with ProgressBar, {progress}/{target}{unit} · %, period badge, tap → goals view. Recent journal: mood emoji (MOODS lookup) + friendlyDay + 2-line clamp preview, "Open diary" → diary.
  - framer-motion used lightly: FadeIn wrapper (mount-only fade/slide, small stagger delays).
- tasks-view.tsx (`TasksView`, "use client"):
  - Data: useQuery(["todos","full"]) — IMPORTANT: queryFn fetches active + completed in parallel via todosApi.list({status:"active"}) + todosApi.list({status:"completed"}) and merges, because api.ts strips status "all" (no param) and the backend then defaults to active-only (verified by curl). All filtering/grouping is client-side for snappy UX. Mutations invalidate ["todos"] + ["stats"] prefixes.
  - ViewHeader "Tasks" + "{doneToday} done today · {overdueCount} overdue" (completedAt local-day computed via dateToKey) + "Clear completed" outline button (shown when completed exist) → AlertDialog confirm → todosApi.clearCompleted.
  - Quick add card: input (Enter or + button), cycling priority chip (low→medium→high→urgent, colored) and due chip (No date→Today→Tomorrow) — due dates built as local-midnight ISO via new Date(y,m,d).toISOString() so local day keys round-trip correctly.
  - Filter Tabs (All/Today/Upcoming/Overdue/Completed) + scrollable category chips (All + TODO_CATEGORIES with emoji, aria-pressed).
  - Grouping: Overdue (red-tinted rows + destructive label) / Today / Tomorrow / Upcoming / No date, sticky group labels (top-16 under mobile bar, top-0 desktop, bg-card/95 backdrop-blur); Completed as collapsed section (count + inline Clear, chevron rotate, max-h-72 scrollable, sorted completedAt desc, muted + line-through).
  - Rows: custom animated check button (role=checkbox, 44px hit area), title with animated strike (line-through + decoration-transparent→color transition), notes preview (FileText, line-clamp-1), PriorityBadge + CategoryBadge + due chip (Clock; amber today / red overdue / muted future, formatDueLabel) + reminder bell; kebab DropdownMenu (Edit, Delete w/ AlertDialog confirm) with 44px touch target.
  - Edit dialog: title, notes, priority/category Selects, due date + time inputs (combined → local ISO; clearing date → null), reminder datetime-local (ISO on save, empty → null); remounts per todo via key.
  - Empty states per tab (+ category-scoped copy when a category filter yields nothing), action focuses the quick-add input.
- OUT-OF-SCOPE FIX (1 file, documented): src/lib/notifications.ts line 100 referenced undefined `last` (pre-existing Task-1 bug; also visible in tsc). It crashed the whole app (Next error overlay) as soon as any todo was due today after 9 AM — i.e. instantly triggered by the new Tasks view. Applied minimal fix: compute `const last = notified[id] ?? 0` inside the final else branch. No behavior change beyond un-crashing.
- Verified end-to-end with headless browser (agent-browser): onboarding card + starter-habit mutation (+toast, streak=1 in API), habit chip optimistic toggle, dashboard sections/banners; tasks: quick add (Enter + button), priority/due cycling, grouping (Today/Tomorrow/Overdue red tint/No date/Completed), optimistic toggle both directions, edit dialog (title/notes/priority save, date+time combine → "Today · 2:30 PM" chip, date clear → null), kebab Edit/Delete dialogs, tabs (Today/Completed/Overdue), category chips, clear-completed, per-tab/category empty states, mobile 390x844 + desktop 1280 layouts. `bun run lint` → 0 errors. tsc: no errors from these files (pre-existing errors remain in examples/, skills/, dates.ts weekStartsOn typing, notifications.ts — now fixed).
- Workarounds/decisions for future agents:
  - Query-key ownership: ["todos","all"] is owned by notification-engine/bell-menu with queryFn status "active" — do NOT register a different queryFn under that key (TanStack v5 lets the latest observer win the fetcher). Full-list consumers use ["todos","full"] (active+completed merge); invalidate with the ["todos"] prefix to hit both.
  - Due-day keys on the client must be derived via dateToKey(new Date(iso)) (local), never iso.slice(0,10) (UTC).
  - "Sticky-feeling" quick-add interpreted as elevated visual card (not position:sticky) to avoid z/offset conflicts with the spec'd sticky day-group labels.
  - Sticky group labels use top-16 lg:top-0 (mobile app-header ≈65px) instead of top-0.

Stage Summary:
- Dashboard + Tasks views complete and browser-verified; both are "use client", use the typed api client, TanStack Query with optimistic updates, sonner toasts, shared components, emerald/teal theme (no indigo/blue). One out-of-scope crash fix in lib/notifications.ts (undefined `last`). Demo data left in DB (3 starter habits + 1 task due today 5 PM) so the preview shows a live dashboard. NEXT: 3-b (routine), 3-c (goals/notes/diary/settings) should follow the query-key + day-key conventions above.

---
Task ID: 3-c
Agent: frontend-developer
Task: Frontend — Notes view (notes-view.tsx), Diary view (diary-view.tsx), Settings view (settings-view.tsx)

Work Log:
- Read worklog contract, types.ts, api.ts, dates.ts, store.ts, export.ts, notifications.ts, all shared components, shadcn ui primitives, goals-view (style reference); curl-verified /api/notes, /api/journal, /api/settings, /api/export shapes before coding. Replaced ONLY the three stub files (named exports NotesView / DiaryView / SettingsView, all "use client", TanStack Query + typed api client + sonner toasts).
- notes-view.tsx:
  - Data: useQuery(["notes"], notesApi.list). Loading = masonry skeleton; error = retry card. Mutations invalidate ["notes"] + ["stats"].
  - ViewHeader "Notes" / "Quick capture & ideas" + New note button + Download dropdown (Export Markdown / Export PDF) with per-action spinner + loading→success/error toasts.
  - Search Input (Search icon, X clear button) filtering title+content+tag client-side; horizontal-scroll tag chips derived from existing tags ("All (n)" + "# tag (n)", re-click to clear); server already returns pinned-first/updatedAt-DESC order.
  - Masonry grid `columns-1 sm:columns-2 gap-4` with `break-inside-avoid` cards; NOTE_COLORS → soft tailwind styles (yellow→amber-500/10 etc., default→bg-card). Card = role=button keyboard-accessible (Enter/Space), Pin icon filled amber when pinned, MarkdownContent preview line-clamp-4, # tag Badge, "Edited Xm ago" relative time + kebab (Pin/Unpin, Edit, Delete w/ AlertDialog).
  - Editor Dialog (create + edit): title Input, content Textarea rows 10 + "Markdown supported" hint, tag Input with datalist of existing tags, 6 color swatches (scale+ring when selected), pin Switch, Preview toggle (Eye/Pencil) rendering MarkdownContent live. Explicit Save (no autosave) → create/update → invalidate + toast.
  - Empty states: StickyNote "No notes yet" (+ New note action) and Search "No matching notes" (+ Clear filters action).
  - PDF export builds per-note HTML from the loaded notes query (h3-styled title + tag line + miniMarkdownToHtml(content) + hr) → printHtml("Notes", html); markdown export → exportApi.markdown("notes") → downloadMarkdown("momentum-notes.md"). (Interpreted the spec's "fetch markdown, convert with miniMarkdownToHtml" as building the specified per-note HTML from the same client data — the server markdown's `####` headings and `---` rules don't map to the requested h3/hr output.)
  - BUG FIXED DURING E2E: DropdownMenuContent is DOM-portaled but remains a React-tree child of the clickable Card, so synthetic clicks on menu items bubbled up and ALSO opened the edit dialog (pin/delete clicks opened the editor with a stale note). Fix: `onClick={(e) => e.stopPropagation()}` on DropdownMenuContent (kebab trigger Button already had it). DiaryView's timeline kebab is a flex sibling of the expand button, so it's unaffected.
- diary-view.tsx:
  - Data: useQuery(["journal"], () => journalApi.list({ limit: 366 })) — single source for editor + timeline + streaks (current entry found by date key). Shared useQuery(["settings"], settingsApi.get) only to feed the calendar's weekStartsOn. Mutations invalidate ["journal"] + ["stats"].
  - Hero editor Card: date nav row (prev-day ChevronLeft, big date label = Popover+Calendar trigger showing "Today · " prefix + formatKeyLong on sm+ / formatKeyLabel on mobile, next-day ChevronRight disabled when tomorrow would be future; Calendar disabled after today, weekStartsOn from settings); MOODS 5-emoji selector (selected scales-110 + primary ring; re-click deselects); Energy Slider 1–5 (Low/High labels, x/5 readout, default 3); headline Input ("What's the headline of your day?"); gratitude Input with Heart icon; content Textarea rows 8 + markdown hint; Save/Update entry button (Save→"Diary saved", Update→"Diary updated" toasts) + transient "Saved ✓" chip (3s) + "Entry exists for this day" hint. Form syncs from the list entry via a date+updatedAt signature (no clobbering mid-typing; empty-day guard toast + textarea focus).
  - Stat chips above editor: total entries, this-calendar-month count, longest consecutive-day streak (client-side walk over date keys).
  - Timeline "Past entries": entries date DESC grouped under monthLabel headers; rows show mood emoji (or ·), formatKeyLabel + weekday + Today badge, title-or-60-char preview; grid-template-rows accordion expand (ChevronDown rotate) revealing mood/energy badges, full MarkdownContent, gratitude heart line; kebab: "Open this day" (loads into editor + smooth-scrolls to top), "Delete entry" (AlertDialog → journalApi.remove).
  - Empty state: BookOpen "Your story starts today" + "Write today's entry" (sets date=today, scrolls up, focuses content textarea via ref).
  - Exports: header Download dropdown → markdown (exportApi.markdown("journal") → momentum-diary.md) and PDF (per entry, date-ascending: date heading + mood emoji + energy + ♥ gratitude + miniMarkdownToHtml(content) + hr → printHtml("Daily Diary", html)); busy spinners + toasts.
- settings-view.tsx:
  - Data: useQuery(["settings"], settingsApi.get); single updateSettings mutation with optimistic cache patch + rollback, success message per action, invalidates ["settings"], toasts on success/error.
  - Notifications card: "Browser notifications" Switch — on enable first awaits requestNotificationPermission() (denied/unsupported → error toast + switch stays off; granted → enable + success toast); live "Permission: granted/denied/default/not supported" status line + "Reminders fire while the app is open" hint; destructive helper banner when permission is blocked. "Sound effects" Switch.
  - Preferences card: "Week starts on" Select (Monday/Sunday → weekStartsOn 1/0) and "Start on view" Select (Dashboard/Tasks/Routine/Goals/Notes/Diary; unknown stored values get a dynamic fallback option) — both with hint lines.
  - Data & export card: 2-col grid of 6 busy-aware outline buttons w/ icon tiles (FileText export-all-md → momentum-export.md, DatabaseBackup JSON backup → momentum-backup.json, Printer full PDF via exportApi.markdown("all") + miniMarkdownToHtml + printHtml("Complete Export"), BookOpen diary-only, ListTodo tasks-only, StickyNote notes-only); per-button "Preparing…" spinner + loading/success/error toasts.
  - About card: emerald→teal gradient Zap tile, Momentum + v1.0 badge, one-liner, tech chips (Next.js, Prisma, Tailwind).
- E2E-verified with agent-browser (headless): notes — search (match/no-match/clear-filters), tag chips, card→editor dialog open, Preview toggle rendering markdown, create note (tag/color/pin), kebab pin/unpin ordering, delete w/ AlertDialog, both exports (toasts + clean print-root teardown); diary — prev-day nav, calendar jump, mood/energy/headline/gratitude edit + save + "Update" flip + Saved chip, timeline expand (badges/markdown/gratitude), "Open this day", delete entry (AlertDialog), streak chips updating 2→1, both exports; settings — all switches/selects round-tripped against the API then restored, permission-denied path (headless auto-deny → switch stays off + error toast), all 6 exports. Mobile 390×844 + desktop 1280×800 + dark-mode screenshots for all three views; zero page/console errors.
- `bun run lint` → 0 errors. `bunx tsc --noEmit` → no errors in the three view files (pre-existing errors remain in examples/, skills/, src/lib/dates.ts weekStartsOn typing — foundation files, not touched). dev.log clean.
- Demo data left per main agent's request: notes = "Welcome to Momentum 🚀" (teal, tag guide, pinned, markdown body explaining note features) + "Grocery list" (yellow, tag errands, unpinned); journal = 1 entry for today (mood good, energy 4, title "Setting up Momentum", gratitude line); settings back to server defaults (notificationsEnabled true, sound true, weekStartsOn 1, defaultView dashboard).
- Notes for future agents:
  - React portals: menu/dialog content portaled into body still bubbles SYNTHETIC events up the React tree — any clickable wrapper around a DropdownMenu/Popover must stopPropagation on the trigger AND the menu content (or restructure so the menu isn't inside the clickable element, as diary-view's timeline row does).
  - Query keys: ["notes"] and ["journal"] are the canonical keys (also used by quick-add); ["settings"] is shared between SettingsView and DiaryView (calendar week start) — invalidate with the plain prefix.
  - journalApi.list() defaults to limit 50; DiaryView passes 366 so streak/month stats and the timeline see a full year.

Stage Summary:
- Notes + Diary + Settings views complete and browser-verified; all 7 views now live, app fully functional. No changes needed to shared components, api.ts, types.ts, page.tsx or app-shell. Demo data seeded for preview (2 notes + 1 diary entry today).

---
Task ID: 4
Agent: main
Task: End-to-end QA with agent-browser — verify all views, interactions, exports, mobile, dark mode

Work Log:
- Verified dashboard: greeting, quote, stat cards, 7-day week chart, overdue banner, today's focus with optimistic todo toggling, habit chips with toggling, goals cards, journal previews, onboarding empty state logic.
- Tasks view: quick-add input (Enter submit, priority/due chips), 5 filter tabs + category chips, day-grouped list w/ sticky labels, edit dialog (title/notes/priority/category/due+time combine → ISO, reminder), kebab Edit/Delete, completed collapse + Clear completed. Task "Write QA report for Momentum v2" created/edited via UI and verified server-side.
- Routine view: habits tab (progress banner, grouped cards, streak flames 🔥, WeekDots, big check toggle w/ optimistic update + streak toast), schedule tab (empty state), New habit/New block dialogs verified.
- Goals view: stat chips, period tabs + status chips, goal create dialog (created "Study Spanish vocabulary" learning goal), optimistic ± increment verified against server (3/10 words 30% — UI === DB).
- Notes view: masonry grid, search, tag chips, color cards, pin, editor dialog w/ markdown preview toggle; created "Ideas for side project" note — markdown (bold/italic/lists) renders correctly.
- Diary view: date navigation (prev day, next disabled on future), mood selector, energy slider, save/upsert (saved entry for yesterday), stats chips (entries/this month/streak), timeline with accordion.
- Settings view: notification permission flow (request → denied in headless → helpful blocked banner), sound switch, week-start + default-view selects, all 6 export buttons present; export APIs curl-verified: markdown scope=all (well-structured sections: Tasks/Routine/Notes/...) and JSON backup (all tables + counts).
- Bell menu: shows "DUE TODAY · 1" + "HABITS REMAINING · 1" correctly from live data.
- Quick Add dialog (mobile): Task tab with priority + due chips → created "Plan weekend hiking trip" high/tomorrow, verified on server + dashboard.
- Mobile 390×844: top bar, bottom 5-tab nav, More sheet (Notes/Diary/Settings + theme), no overlap/cut-off. Desktop 1280: sidebar + content max-w-4xl. Dark mode verified.
- Fixed: (a) api.ts todos list now sends status=all explicitly (backend default was active-only); (b) dates.ts date-fns `Day` typing errors; (c) added SheetDescription to More sheet (killed the Radix a11y warning); (d) subagent 3-a had fixed a pre-existing crash in notifications.ts (undefined `last`).
- VLM visual review of 5 key screenshots (desktop light/dark, mobile dashboard/quick-add): "polished, production-ready, no critical bugs".
- Final state: lint 0 errors, tsc 0 errors in src/, 0 page errors, 0 console warnings after full reload.

Stage Summary:
- App is fully functional and browser-verified end-to-end. Demo data intentionally present: 3 habits (2 done today), 2 active tasks + 1 completed, 1 learning goal (3/10), 3 notes, 2 diary entries. Remaining known-minor: none blocking. Next: Task 5 cron job + final handover.
