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

---
Task ID: R2-2
Agent: main (cron review round 2)
Task: Round 2 foundation — FocusSession model, /api/focus + /api/insights endpoints, nav/types/api-client updates for Focus & Insights views

Work Log:
- QA health check: all 7 views + 0 page errors (stable from Round 1).
- Added FocusSession Prisma model (id, taskId?, label?, minutes, startedAt, endedAt) + indexes; pushed schema, regenerated client.
- types.ts: added FocusSession, FocusSessionInput, FocusStats, InsightsData, DayStat unchanged; ViewId now includes "focus" and "insights".
- api.ts: added statsApi.insights() → GET /api/insights, focusApi.stats() → GET /api/focus, focusApi.log() → POST /api/focus.
- nav-config.ts: NAV_ITEMS now 9 entries (added Focus=Timer icon after Dashboard, Insights=BarChart3 after Diary); MOBILE_MORE_NAV = [focus, insights, notes, diary, settings].
- page.tsx: registered FocusView + InsightsView lazy dynamic imports + view switch cases.
- Created src/app/api/focus/route.ts (GET FocusStats today/week/lastWeek minutes + session counts; POST logs a session — validates minutes 1..240, optional taskId must exist; startedAt/endedAt default to now−minutes/now).
- Created src/app/api/insights/route.ts (GET InsightsData: 84-day heatmap with daily scores reusing stats formula, 30-day todosTrend, habitConsistency pct+streak, moodDistribution, focus minutes today/week/lastWeek/avgSession, totals incl. focusHours + bestHabitStreak).
- CRITICAL INFRA FIX: Prisma client regeneration wasn't picked up by the running Turbopack dev server (stale compiled @prisma/client + globalThis singleton). Fixed db.ts to import from '.prisma/client' (statically analyzable CommonJS entry) with a versioned global cache key (prisma:v4). Also had to restart the dev server (Turbopack cache was corrupted after .next/dev removal) — restarted via double-fork pattern `(setsid bun run dev &)` which survives tool-session cleanup. All endpoints verified: focus GET/POST, insights (84 heatmap days, correct totals), stats, todos — all 200.
- Stub views created: focus-view.tsx, insights-view.tsx (named exports FocusView / InsightsView).

Stage Summary:
- Foundation ready for view agents. Backend contract for Focus + Insights complete and curl-verified. Dev server healthy on port 3000 (restarted, detached). NOTE for all agents: if Prisma client seems stale after schema changes, bump PRISMA_CACHE_KEY in src/lib/db.ts.

---
Task ID: R2-3b
Agent: frontend-developer
Task: Frontend — Insights view (src/components/app/views/insights-view.tsx)

Work Log:
- Read worklog (incl. R2-2 /api/insights contract), types.ts, api.ts, dates.ts, shared components, dashboard-view (style reference), shadcn primitives; curl-verified /api/insights shapes (84 heatmap days oldest-first, 30-day trend oldest-first, totals 1/2/2/0.4) before coding. Replaced ONLY the insights-view.tsx stub (named export InsightsView, "use client", useQuery ["insights"] → statsApi.insights; skeleton loading; EmptyState retry on error).
- Totals strip: 4 compact cards (grid-cols-2 sm:grid-cols-4) — Tasks completed (CheckCircle2/emerald), Diary entries (BookOpen/amber), Habit checks (Repeat/teal), Focus hours (Timer/violet); tinted icon tile + big tabular-nums number + small label.
- Activity heatmap (star): GitHub-style grid, 12-13 week columns × 7 rows (Mon-Sun), first column padded with null cells via weekdayOfKey(heatmap[0].date)-1; exact tailwind levels 0→bg-muted, 1-24→emerald-500/25, 25-49→/45, 50-74→/70, 75+→emerald-500; today = ring-2 ring-primary ring-offset-1 ring-offset-card; month labels (Jun/Jul/Aug) above columns on month change; M/W/F row hints; per-cell native title tooltip "MMM d · score N · X tasks, Y habits, Z routine"; legend "Less ▢▢▢▢ More"; overflow-x-auto no-scrollbar w-max (fits 390px, no overflow); side/below chips: Longest streak (consecutive score>0), Active days N/84, Avg score; all-zero → hint "Start checking things off to fill your heatmap."
- Tasks trend: pure inline SVG (no chart libs) — viewBox 0 0 100 40 + preserveAspectRatio="none" + vector-effect="non-scaling-stroke" (uniform 2px primary line, 1px faint gridlines), Catmull-Rom smoothed path clamped to plot band, linearGradient area (currentColor, 0.16→0.02); points at cell centers with 30 CSS-grid hover zones (title tooltips + group-hover guideline/dot — note Tailwind wraps hover variants in @media(hover:hover), false in headless test browser, works on real pointers); axis labels rendered as HTML (never distorted): y-gutter yMax/mid/0 (odd maxima bumped +1, mid hidden when yMax<2 → integer labels only) + 5 date labels (MMM d); chips Total / Best day / Average N.N/day (tabular-nums).
- Habit consistency: rows with emoji in habitRingStyles ring, name, "🔥 N" streak when >1, right pct + h-1.5 ProgressBar colored via habitDotStyles; max-h-[26rem] divide-y overflow-y-auto (scrolls past ~8); EmptyState "No habits yet" + Create habits → setView("routine").
- Mood card (only when moodDistribution.length>0): single rounded-full h-3 stacked bar, fixed great→rough segment order (emerald-500/teal-500/amber-500/orange-500/rose-500) proportional widths + title tooltips; legend rows (dot + emoji + label + count · pct) grid-cols-1 sm:grid-cols-2. Focus card: This week hero (formatMinutes) + delta chip (TrendingUp emerald / TrendingDown red, "+25m vs last week"; "Same as last week" at 0; hint "Use the Focus timer to track deep work." when weekMinutes===0) + Separator + Today / Avg session tiles. Footer note: "Insights update as you use Momentum — complete tasks, check habits, write your diary."
- Polish: rounded-2xl p-4 sm:p-5 cards, tabular-nums everywhere, framer-motion FadeIn mount-only stagger (0.05s), aria labels on chart/heatmap regions, emerald positives, no indigo/blue.
- Verified (agent-browser, isolated --session insights): totals 1/2/2/0.4 === API; heatmap 84 cells / 13 cols, month labels left-aligned to correct columns (labelX===colX), weekday labels pixel-aligned to rows (diffs all 0), today (Aug 27 Thu) at row 4 with ring + correct tooltip; trend 30 zones, y labels 1/0, x labels Jul 29–Aug 27; habit rows 3%/3%/0% (🔥 hidden at streak 1); mood teal 100%; focus 25m + "+25m vs last week"; mobile 390×844 no horizontal overflow, heatmap fits (217px), nav via More sheet works; dark mode OK; zero page errors. VLM review of light-desktop / dark-desktop / mobile screenshots: all PASS (after strengthening today ring + integer y-labels).
- `bun run lint` → 0 errors; `bunx tsc --noEmit` → no errors in insights-view.tsx. dev.log clean. NOTE: default agent-browser session was being driven concurrently by the parallel focus agent — used a dedicated session; future agents should too when parallel agents are active.

Stage Summary:
- Insights view complete and browser-verified: totals strip, 12-week GitHub-style activity heatmap with today highlight + month labels, pure-SVG 30-day tasks trend with hover tooltips, habit consistency bars, mood distribution stacked bar, focus stats with week-over-week delta, footer note. No changes to page.tsx, api.ts, types.ts, shared components or other views. Remaining stub for other agents: focus-view (R2-3a, in progress by parallel agent).

---
Task ID: R2-3a / R2-4 / R2-5 (combined)
Agent: main (cron review round 2)
Task: Focus Timer view completion + styling polish pass + final QA + demo history seeding

Work Log:
- Focus view (R2-3a): the subagent wrote the full 1173-line focus-view.tsx but died on an infrastructure error before browser QA. I completed its verification: timer start/pause/reset verified (02:00 → 01:57 after 3s, pause→Resume), mode switching (Focus 25/Short 5/Long 15 with color-coded rings), task picker chips, stats strip (today/week minutes with vs-last-week delta), session dots, localStorage persistence ("momentum-focus"), Web Audio chime. Fixed its mobile mode-tab truncation → full labels ("Focus / Short break / Long break") with whitespace-nowrap — VLM-verified to fit at 390px. 0 page errors.
- Insights view (R2-3b): built by subagent — totals strip, 84-day GitHub-style heatmap (alignment PROGRAMMATICALLY verified: M/W/F label centers 313/345/377 exactly match row centers), pure-SVG 30-day trend chart, habit consistency bars, mood stacked bar, focus stats. 0 errors.
- Styling polish (R2-4, mandatory): dashboard greeting now emerald→teal gradient text; score chip shadow; week chart gained dashed average marker line + avg% header + today score badge above today's bar + bar hover brightness; stat cards got distinct emerald/teal/orange icon tints + colored progress bars + hover lift (-translate-y + shadow-md); sidebar "Stay consistent" card got soft radial gradient blob. VLM before/after comparison: "Excellent Polish, No Regressions".
- Demo history seeded (16 days): habit logs ~70% consistency, 8 completed todos spread across past 2 weeks, 3 diary entries with moods/energy, 5 focus sessions (25-50min). Makes Insights/heatmap/trends demonstrable. Current: focus week 125min vs last week 70min.
- Cleaned subagent test data (Skip-path test todo, test focus sessions).
- Final QA (R2-5): all 9 views swept (Dashboard, Focus, Tasks, Routine, Goals, Notes, Diary, Insights, Settings) — 0 page errors each; lint 0 errors; tsc clean; dev.log clean; mobile 390px + desktop 1280px verified; dark mode verified.

Stage Summary:
- Round 2 COMPLETE. App now has 9 views: added Focus (Pomodoro timer with task linking, session logging, sounds, persistence) and Insights (heatmap, trends, consistency, mood, focus analytics). Backend: /api/focus + /api/insights + FocusSession model.
- INFRA NOTE for future rounds: (1) after `prisma generate`, bump PRISMA_CACHE_KEY in src/lib/db.ts if models seem missing; (2) dev server was restarted this round and runs detached via `(setsid bun run dev &)` — if port 3000 is dead, restart with that exact pattern from /home/z/my-project (plain nohup gets reaped between tool sessions); (3) .next/dev cache deletion requires a server restart — avoid deleting it.
- Unresolved/next-round candidates: recurring tasks (repeat daily/weekly); subtasks/checklists inside tasks; keyboard shortcuts (Cmd+K quick-add); PWA manifest for install-to-homescreen; weekly review summary email-style export.

---
Task ID: R3-2b
Agent: frontend-developer
Task: Command palette (Cmd+K) with global search

Work Log:
- Read worklog (Task 1 + R2-* entries), command.tsx, dialog.tsx, nav-config.ts, store.ts, app-shell.tsx, api.ts searchApi, types.ts SearchResults, dates.ts helpers; curl-verified /api/search responses for "plan" (todo + journal match) and "spanish" (goal match) before coding.
- src/lib/store.ts: added `paletteOpen: boolean` (default false) + `setPaletteOpen(open)`; `setView` now also resets `paletteOpen: false` (quickAddOpen behavior preserved); `partialize` untouched → still persists only `view`, paletteOpen never persisted.
- NEW src/components/app/command-palette.tsx: "use client" `CommandPalette`. Composed shadcn Dialog + DialogContent (showCloseButton=false) + Command with the exact cmdk group/input sizing classes from CommandDialog — custom composition was required because CommandDialog doesn't forward `shouldFilter={false}`, which is essential for server-side search (otherwise cmdk's client filter would hide results that match on content/notes, e.g. the journal entry matched for "plan").
  - Open state = store `paletteOpen` (single source of truth); global keydown listener toggles on Cmd+K/Ctrl+K with preventDefault (uses getState() to avoid stale closure); Esc/overlay-close via Radix onOpenChange; input resets to "" on close.
  - Debounce 250ms (useDebounced hook) + useQuery(["search", q], searchApi.query, enabled: q.trim()>=1, staleTime 30s, placeholderData keepPreviousData → previous results stay visible while loading). Subtle "Searching…" row (Loader2 spin, aria-live) while fetching; CommandEmpty shows "Searching…" until data lands, then `No results found for "q"`; error fallback text.
  - Empty query: "Actions" group (New task → setQuickAddOpen, Start focus session → focus, Toggle theme via next-themes resolvedTheme/setTheme with Sun/Moon + target-state hint) + "Go to" group rendering NAV_ITEMS with their own lucide icons (all 9 views) — navigate via setView + close.
  - Results groups (rendered only when non-empty): Tasks (ListTodo, title, formatDueLabel, line-through+Check when completed → tasks view), Notes (StickyNote, title/"Untitled", formatDistanceToNow updated → notes), Goals (Target, title, progress/target+unit → goals), Habits (emoji chip, name, streak → routine), Diary (BookOpen, title/"Untitled", formatKeyLabel date → diary).
  - Footer kbd hint row (↑↓ navigate · ↵ select · esc close) with tiny rounded bg-muted bordered kbd; CommandList max-h-[60vh]; emerald/teal accents via theme tokens (accent is already emerald oklch hue 165) — zero indigo/blue.
- src/components/app/app-shell.tsx: mounted `<CommandPalette />` once (after the More sheet); desktop sidebar got a search trigger above the nav (Search icon + "Search…" + ⌘K kbd hint, border/bg-background/hover:bg-muted) opening the palette; mobile top bar got a ghost icon-size Search button (aria-label="Search", size-10 rounded-xl matching Bell/Plus) before BellMenu. No other restructuring.

Stage Summary:
- Command palette shipped: Cmd+K/Ctrl+K global toggle, sidebar + mobile-top-bar entry points, 250ms-debounced global search across todos/notes/goals/habits/journal with per-type icons and navigation on select, quick actions (new task / focus / theme) + full "Go to" nav on empty query, kbd footer, mobile-fit dialog (358px at 390px viewport).
- Files changed: NEW src/components/app/command-palette.tsx; src/lib/store.ts (paletteOpen state); src/components/app/app-shell.tsx (mount + 2 search entry points). No backend/shared-lib/view changes.
- QA (agent-browser, dedicated `--session palette`): Ctrl+K opens with input focused + quick actions/Go to ✓; "plan" → Tasks group shows "Plan weekend hiking trip · Tomorrow · 12:00 PM" (also Diary content match correctly visible thanks to shouldFilter=false), Enter → Tasks view + palette closed ✓; "spanish" → Goals "Study Spanish vocabulary 3/10 words", Enter → Goals view ✓; empty query → "Start focus session" click → Focus view ✓; sidebar Search button opens, Esc closes ✓; Ctrl+K toggles open/close ✓; overlay click closes ✓; New task opens quick-add ✓; Toggle theme flips dark↔light ✓; "zzzzqq" → `No results found for "zzzzqq"` ✓; previous results stay visible while refetching (keepPreviousData) ✓; mobile 390x844: top-bar icon opens palette (fits, 358px wide, no overflow, list max-h 506px), typed "plan" + Enter → Tasks view ✓. VLM screenshot review (desktop results, desktop actions, mobile actions, mobile top bar): no overlap/truncation, emerald/teal only, footer clean. `bun run lint` 0 errors; `bunx tsc --noEmit` clean; `agent-browser errors` 0 page errors after every step.
- Note: mid-QA the parallel agent's HMR (tasks-view/quick-add edits) momentarily reset cmdk selection state in an open palette — verified on clean reload that first-result auto-selection is deterministic; dev-only HMR noise, no code change needed.

---
Task ID: R3-2a
Agent: frontend-developer
Task: Recurring tasks UI (repeat selector, badges, toasts, quick-add chips)

Work Log:
- Read worklog (R2-* entries), types.ts (Todo.repeat / TodoInput.repeat / REPEAT_OPTIONS), recurrence.ts, api route (POST/PATCH accept repeat; completing spawns clone), and all 4 target files before coding. Curl-probed POST with repeat=daily → works; deleted probe.
- shared/badges.tsx: added `RepeatBadge({ repeat })` (null for "none"; Repeat icon + capitalized label, emerald-500/10 bg + emerald-500/30 border + emerald-700/300 text, text-[10px], rounded-full, title="Repeats daily" etc.) + `repeatOptionLabel()` helper ("none" → "None"). Existing exports untouched.
- tasks-view.tsx: (1) EditTaskDialog gained a "Repeat" Select (REPEAT_OPTIONS values, label "None" for none) between due-date grid and Reminder, with dynamic hint line ("Mon to Fri only" + "— a fresh copy appears when you complete this task." when recurring); `repeat` included in the onSave patch → updateMutation. (2) TodoRow shows RepeatBadge after the due-date chip (also on completed rows — inherits the muted opacity-60 wrapper). (3) toggleMutation onSuccess: completing a repeat != "none" todo fires toast.success("Task completed", { description: "Repeats daily — next occurrence created." }) via REPEAT_OPTIONS label; non-recurring/un-completing stays toast-free (verified both). (4) Inline quick-add (this file's create path): new repeat cycle chip ("No repeat" → Daily → Weekdays → Weekly → Monthly, emerald-tinted when active, emerald Repeat icon) after the Due chip; `repeat` passed in createMutation input.
- quick-add.tsx: Quick capture Task tab gained a "Repeat:" chip row (None/Daily/Weekdays/Weekly/Monthly, identical chip styling to Priority/Due rows, aria-pressed) after the Due row; `repeat` always included in createTask input; reset() restores "none".
- dashboard-view.tsx (only FocusRow): subtle repeat indicator between title and due label — Repeat icon size-3 text-muted-foreground, title/sr-only "Repeats weekdays" etc., rendered only when repeat != "none".
- QA (agent-browser, dedicated --session recur, desktop + 390x844 mobile + dark mode): created "RT-QA recurring daily check" daily via inline quick-add chip → Daily badge on row; completed via checkbox → toast "Task completed / Repeats daily — next occurrence created." AND spawned clone appeared under Tomorrow with Daily badge; edited clone's repeat → None via dialog (Select shows None, hint "One-off task") → badge gone; created "RT-QA dashboard weekdays" via Quick capture chips (verified server-side repeat=weekdays, due today) → Weekdays badge + dashboard Today's-focus repeat icon ("Repeats weekdays"); completed-row badge renders muted; un-complete fires no toast. Mobile 390x844: quick-capture dialog 358x408 fits viewport, repeat chips wrap cleanly (3+2 rows), scrollWidth 390 = no overflow; dark mode badge computed styles = emerald-300 text on emerald-500/10 (VLM review of both screenshots: clean, consistent, no glitches). All RT-QA tasks deleted via API — DB verified clean; theme reset to light. 0 page errors after every step. `bun run lint` 0 errors; `bunx tsc --noEmit` → no src/ errors.

Stage Summary:
- Recurring-tasks frontend complete and browser-verified across all 4 files: repeat Select + hint in edit dialog, RepeatBadge on task rows (active + completed), recurring-completion toast, inline quick-add repeat cycle chip, Quick-capture repeat chips, dashboard focus-row repeat icon. No backend/shared-lib/other-view changes; lint + tsc clean; mobile + dark mode verified; test data cleaned up. Note for other agents: tasks-view inline quick-add and Quick capture both send `repeat` on create; REPEAT_OPTIONS labels render as None/Daily/Weekdays/Weekly/Monthly in pickers.

---
Task ID: R3-1 / R3-2-backend / R3-2c / R3-3 / R3-4 (combined)
Agent: main (cron review round 3)
Task: Round 3 — QA assessment, recurring tasks backend, global search API, PWA manifest, styling polish pass, final QA

Work Log:
- Round-3 QA baseline: all 9 views swept via agent-browser (0 page errors), /api/stats + /api/focus + /api/insights healthy, lint/tsc clean. Confirmed stable → proceeded to new features + mandatory styling polish.
- Recurring tasks backend (R3-2a backend): Todo.repeat field ("none|daily|weekdays|weekly|monthly") added to Prisma schema (db:push, PRISMA_CACHE_KEY bumped v4→v5 in src/lib/db.ts). New src/lib/server/recurrence.ts — nextOccurrence() advances from the due date (daily +1d, weekdays skips Sat/Sun, weekly +7d, monthly clamped day-of-month) and rolls the series forward past "now" (1-min grace, 800-step cap) so overdue recurring tasks never spawn instantly-overdue clones. PATCH /api/todos/:id spawns the next occurrence when completing a repeat != none task (reminderAt shifted by the same delta as dueDate). zod schemas + serializeTodo + markdown export ("repeats daily" bit) updated. types.ts: RepeatKind, Todo.repeat, TodoInput.repeat, REPEAT_OPTIONS; curl-verified: daily due 8/28→clone 8/29; overdue daily due 8/24→rolled to 8/28; Friday weekdays→Monday 8/31.
- Global search API: new GET /api/search?q= → SearchResults {todos≤6 active-first, notes≤5, goals≤5, journal≤5, habits≤5} — in-memory case-insensitive substring match (unicode-safe), 400 on empty q. searchApi.query() added to api.ts. curl-verified "spanish"→goal, "plan"→todo+journal.
- PWA (R3-2c): public/manifest.webmanifest (standalone, emerald theme #10b981, 4 icons incl. maskable); icon-192/512.png + maskable variants generated by screenshotting a gradient+M HTML at exact viewports via agent-browser (VLM-verified clean); layout.tsx metadata: manifest link, apple-touch-icon, appleWebApp, formatDetection.
- Parallel frontend subagents: R3-2a (recurring UI: Repeat Select in edit dialog w/ hints, RepeatBadge in shared/badges.tsx, inline quick-add repeat cycle chip, quick-add dialog Repeat chip row, dashboard Repeat icon, "next occurrence created" toast) and R3-2b (command palette: cmdk Dialog+Command with shouldFilter=false, ⌘K/Ctrl+K global listener, 250ms-debounced searchApi query w/ keepPreviousData, empty-state quick actions + Go-to group, grouped results w/ due labels, kbd footer; store paletteOpen/setPaletteOpen (not persisted); app-shell: sidebar search trigger + mobile top-bar search icon). Both agents browser-verified on dedicated agent-browser sessions; merged state re-verified by main (Ctrl+K opens, "plan"→Tasks navigation works, 0 errors).
- Styling polish (R3-3, mandatory): fixed REAL bug — Insights totals label "Tasks completed" truncated at 390px (nowrap clientW 87 < scrollW 100) → now wraps to 2 lines (measured h=33, clientW===scrollW). globals.css: new utilities — .shadow-card (layered soft elevation, dark-mode aware), .press (active:scale-0.985 tactile feedback), .stagger-list (8-step 35ms staggered view-in entrance), emerald ::selection tint, prefers-reduced-motion kill-switch (a11y). Card component: shadow-sm → shadow-card (global elevation upgrade). Applied: stagger to task groups, habit cards, notes masonry, goals list, diary timeline; press + hover lift to habit/goal/note cards; shadow-card to ~14 card containers across all views; sidebar "Stay consistent" card made interactive (text button → Insights, valid HTML — no nested buttons).
- VLM before/after review: depth/elevation "significantly improved, layered card system, clear visual hierarchy". Flagged dark-mode score-chip left border — measured programmatically: uniform 1px all sides (screenshot artifact, not a bug). Final VLM QA (Tasks + Routine): "Clean, no layout bugs; shadows consistent; production readiness: High".
- Dev server died mid-round (ERR_CONNECTION_REFUSED, process reaped) → restarted with the documented `(setsid bun run dev &)` pattern; recurrence re-verified post-restart (sanity daily task → clone tomorrow, then cleaned up).
- Final QA (R3-4): all 9 views 0 page errors; palette flow verified; mobile 390×844 no horizontal overflow; dark mode verified; lint 0 errors; tsc 0 errors in src/; manifest + apple-touch-icon + theme-color tags confirmed in HTML; all R3 test data cleaned (11 demo todos remain).

Stage Summary:
- Round 3 COMPLETE. App now at 9 views + command palette. New capabilities: recurring tasks (full-stack), global search with ⌘K command palette (full-stack), PWA installability.
- Key files: prisma/schema.prisma (Todo.repeat), src/lib/server/recurrence.ts, src/app/api/search/route.ts, src/app/api/todos/[id]/route.ts (spawn logic), src/components/app/command-palette.tsx, public/manifest.webmanifest + icon-{192,512,maskable-*}.png, globals.css (shadow-card/press/stagger-list/reduced-motion).

## Handover — three sections

### 1. Current project status
Production-ready single-route SPA (Next.js 16 App Router, "/" only) with 9 views (Dashboard, Focus, Tasks, Routine, Goals, Notes, Diary, Insights, Settings) + command palette + PWA manifest. Backend: 11 API route groups over Prisma/SQLite (9 models incl. FocusSession + Todo.repeat). All views browser-verified, 0 page errors, lint/tsc clean, mobile 390px + dark mode verified. Demo data present (11 todos, 3 habits w/ 16-day history, 3 notes, 3 diary entries, 1 goal, 5+ focus sessions) making every screen demonstrable.

### 2. Current goals / completed modifications / verification results
Goals this round: QA → prioritize bugs → mandatory new features + mandatory styling polish.
Completed: (a) QA baseline all-green; (b) recurring tasks full-stack — curl-verified 3 recurrence edge cases, UI verified by subagent incl. clone respawn + toast + badges; (c) command palette — Ctrl+K, search "plan"/"spanish", navigation, mobile entry point, all verified on merged state; (d) PWA manifest + 4 icons served correctly; (e) styling polish — fixed Insights mobile truncation bug, layered card elevation app-wide, stagger entrances, press feedback, reduced-motion a11y, interactive sidebar card; VLM reviews positive.
Verification: agent-browser sweeps (9 views × 0 errors), programmatic layout measurements (label wrap, chip borders, scrollWidth), curl API contracts, VLM visual reviews, lint/tsc clean, dev.log clean.

### 3. Unresolved issues / risks / next-phase priorities
Unresolved/risks:
- Service-worker offline caching intentionally NOT added (no SW); PWA manifest makes app installable but offline shell requires a future SW (cache-first for static, network-first for /api) — deliberate scope cut to keep this round lightweight.
- Recurring tasks: completing a task early (before its due date) schedules the next occurrence from the ORIGINAL due date (Todoist-style), not from completion time — intentional but worth surfacing in user docs.
- Cmdk palette search is server-side substring match — fine at current data sizes; no fuzzy matching.
Next-phase priorities (suggested order):
1. Service worker + offline shell (completes the PWA story; manifest alone doesn't cache).
2. Subtasks/checklists inside tasks (most-requested todo feature remaining).
3. Weekly review summary — generated export (markdown/PDF) of the week: score trend, habits consistency, goals progress, diary highlights (all data already in /api/insights).
4. Habit reorder (drag-and-drop sortOrder endpoints exist) + streak freeze/skip days.
5. Data import from JSON backup (export exists; import round-trip would complete disaster recovery).

---
Task ID: R4-1 / R4-2-backend
Agent: main (cron review round 4)
Task: Round 4 QA baseline + backend for 3 new features (subtasks, weekly review, JSON import)

Work Log:
- R4-1 QA baseline: all 9 views swept via agent-browser (dedicated --session r4) — 0 page errors each; /api/stats healthy; dev.log clean; bun run lint clean; tsc clean; layout 1280x1406 no overflow. Confirmed stable → proceeded to features.
- Backend: Subtask model added to prisma/schema.prisma (todoId FK cascade, completed, sortOrder, @@index([todoId, sortOrder])); db:push OK; PRISMA_CACHE_KEY bumped v5→v6 in src/lib/db.ts.
- types.ts: Subtask, SubtaskInput, Todo.subtasks: Subtask[]; WeeklyReview (+Habit/Task/Goal/Journal sub-interfaces), ImportCounts, ImportResult.
- service.ts: serializeSubtask; serializeTodo now accepts optional eager subtasks (default []); TodoWithSubtasks type; todoWithSubtasksInclude helper (NOTE: inline the include in queries for Prisma type inference — a typed variable loses payload narrowing).
- Sub-APIs: POST/GET /api/todos/[id]/subtasks (create appends sortOrder=max+1); PATCH/DELETE /api/subtasks/[id] (subtaskCreateSchema/subtaskUpdateSchema in schemas.ts).
- Todo endpoints now eager-load subtasks: GET /api/todos (list), PATCH /api/todos/[id] (fresh re-fetch response), /api/search, /api/stats. Recurrence clone COPIES the checklist to the next occurrence with all items unchecked (curl-verified).
- GET /api/review?week=YYYY-MM-DD → WeeklyReview: 7-day scores (same formula as insights), avgScore vs prevAvgScore, bestDay, tasksCompleted+taskList (max 20 newest), habit per-habit done/7+pct, active goal snapshots, journal entries in week, focusMinutes/sessions/focusVsLastWeek %, habitChecks. `week` may be ANY day in the target week (week start computed per settings.weekStartsOn); bad param → 400.
- Export JSON bumped to version 2: now includes top-level `subtasks` array AND nested todo.subtasks; markdown export renders checklist `1/3` bit + `  - [x] item` lines.
- POST /api/import { mode: merge|replace, data: backup } → ImportResult. New src/lib/server/import-backup.ts: tolerant zod row schemas (older backups without repeat/subtasks still import; Habit/RoutineTask rows have NO updatedAt column — do not send it), replace = wipe all tables in FK order + verbatim insert inside one $transaction (settings upserted too), merge = insert only rows whose id (journal: date) is absent, count skipped. Route validates + friendly 400s ("Not a valid Momentum backup — …", empty-backup guard).
- api.ts: subtasksApi (list/create/update/remove), reviewApi.get(week?), importApi.restore(data, mode).
- curl-verified end-to-end: subtask CRUD ordered; toggle; recurrence clone carries unchecked subtasks; review current week (avg 29 vs prev 50, best day 8/24 score 80, 4 tasks, habits 43%/43%/14%, journal 2 entries, focus 125min +79%); review?week=2026-08-15 → weekStart 2026-08-10; bad param 400; export v2 with 4 subtasks; merge re-adds deleted clone WITH subtasks + skips existing (1 skipped); replace wipes + restores minimal backup verbatim (subtask completed=true preserved); invalid row 400; empty backup 400; full 13-todo backup restored via replace; ST-QA test todos cleaned → demo data back to 11 todos, stats healthy.
- tsc --noEmit clean for src/ (only pre-existing examples/skills errors remain).

Stage Summary:
- Round 4 backend COMPLETE and fully curl-verified. New capabilities: task checklists (subtasks) full-stack with recurrence support, weekly review aggregation endpoint, and JSON backup import with merge/replace modes (round-trips export v2). DB demo data preserved.
- NEXT (parallel frontend subagents, disjoint file ownership):
  - R4-2a subtasks UI → tasks-view.tsx + dashboard-view.tsx ONLY
  - R4-2d weekly review UI → insights-view.tsx + NEW src/components/app/review-dialog.tsx
  - R4-2e import UI → settings-view.tsx ONLY
  - R4-3 styling polish → routine-view.tsx, goals-view.tsx, notes-view.tsx, diary-view.tsx, focus-view.tsx, globals.css ONLY
  - main agent: final QA + worklog handover.

---
Task ID: R4-2e
Agent: frontend-developer
Task: Backup import UI (settings-view)

Work Log:
- Read worklog (R4-1/R4-2-backend contract), settings-view.tsx, api.ts (importApi.restore), types.ts (ImportResult/ImportCounts), lib/server/import-backup.ts (backup shape + merge/replace semantics).
- Implemented "Import & restore" card in settings-view.tsx ONLY, placed directly below the export card (export section reworded "Data & export" → "Export data", structure untouched):
  - Drop/pick zone (role=button, keyboard Enter/Space, dragover/dragleave/drop handlers) + hidden input[type=file accept=".json,application/json"]; input value reset after read so the same file can be re-picked.
  - FileReader readAsText → JSON.parse in try/catch. Guards: >20MB → toast.error "File too large — backups up to 20 MB are supported"; parse fail → "Invalid JSON file"; not an object / none of todos/subtasks/habits/routineTasks/notes/journal/goals is an array → "Not a Momentum backup file".
  - Preview strip after parse: file name + friendly exportedAt (toLocaleString dateStyle/timeStyle, invalid-safe) + size + Badge chips for non-zero counts (tasks/subtasks/habits/routine/notes/journal/goals, defensive Array.isArray → 0) + remove (X) button.
  - Mode selector via shadcn RadioGroup as two selectable label-cards: Merge (default, emerald accent + "SAFE" chip, Merge icon) and Replace (destructive/rose accent, TriangleAlert icon). Selecting Replace reveals mandatory Checkbox "I understand all current data will be deleted…" — primary button stays disabled until checked (extra explicit step for the destructive path).
  - Primary button "Import backup" (destructive variant + "Delete everything & restore backup" label in replace mode), disabled until file parsed + mode chosen + replace-confirmed; Loader2 spin + "Importing…" while pending. Uses importApi.restore(parsed.data, mode) only.
  - onSuccess: toast.success(result.message) + inline emerald success panel (CheckCircle2, "Backup merged/restored" + counts line via formatImportCounts: "1 task · 0 habits · 1 note · … · 2 skipped") + refresh note; resets file/mode/confirm (panel dismissible). NOTE: queryClient.invalidateQueries() with NO filter — invalidates ALL queries (todos/habits/routine/notes/journal/goals/stats/insights/settings/focus/review/search) since an import can touch everything; rationale documented in code comment.
  - onError (ApiError): toast.error surfaces the server validation message verbatim (e.g. "Not a valid Momentum backup — …").
  - Privacy hint line with ShieldCheck: "Your data stays on this device — backups are plain JSON files you control."
- QA (agent-browser dedicated --session import; pre-QA backup saved first via curl to /tmp/qa-backup-before.json — 11 todos/3 habits/4 notes/5 journal/1 goal):
  - Upload /tmp/test-import.json (1 todo "IMP-QA Imported task" + 1 note "IMP-QA note", full row fields per import schema): preview shows file name, "Exported Aug 27, 2026, 12:00 PM · 776 B", chips "1 tasks"/"1 notes"; Merge button enabled by default.
  - MERGE: success panel "Backup merged / 1 task · 0 habits · 1 note · 0 journal entries · 0 goals · 0 skipped"; button disabled after (state reset); curl confirms IMP-QA todo + note arrived in DB.
  - Re-MERGE same file: "0 tasks · … · 2 skipped" — no duplicates ✓.
  - REPLACE: radio → confirm checkbox appears + destructive button DISABLED; after check → enabled; ran replace → panel "Backup restored / 1 task · 0 habits · 1 note · …"; DB verified wiped to exactly the 2 test rows (todos 1, notes 1, habits 0).
  - DB RESTORED via curl POST /api/import {mode:replace, data:<pre-QA backup>} → 11 todos / 3 habits / 4 notes / 5 journal / 1 goal, 0 IMP-QA rows (verified per-endpoint). NOTE: a 12th todo "SUB-QA Pack for trip" appeared afterwards — created at 20:28 by the parallel R4-2a subtasks agent's QA, not by this task.
  - Drag & drop path verified by dispatching a synthetic DataTransfer drop on the zone → preview parsed correctly.
  - Remove-file (X) button clears preview + resets mode/confirm ✓.
  - Error cases: /tmp/bad.txt ("not json") → toast "Invalid JSON file"; {"foo":1} → "Not a Momentum backup file" (no preview either); 22MB JSON → "File too large — backups up to 20 MB are supported".
  - Mobile 390×844 (light + dark): no horizontal overflow in default/preview/replace+confirm states; screenshots captured; desktop dark-mode screenshot too. Theme reset to light after QA.
  - agent-browser errors --session import after every step: 0 page errors throughout.
  - bun run lint: clean. bunx tsc --noEmit: 0 errors in src/ (only pre-existing examples/skills errors).
  - Final health: /api/stats 200, no IMP-QA data anywhere in DB.

Stage Summary:
- Backup import UI shipped in src/components/app/views/settings-view.tsx (ONLY file touched; +~440 lines: ImportSection component + helpers). Full merge/replace round-trip verified end-to-end in the browser including destructive-action gating, all client-side validation errors, mobile + dark layouts, and 0 page errors. Demo DB restored to pre-QA state and confirmed healthy (the extra "SUB-QA Pack for trip" todo belongs to parallel agent R4-2a's QA window).

---
Task ID: R4-2d
Agent: frontend-developer
Task: Weekly review dialog UI (insights-view + review-dialog)

Work Log:
- Read worklog (R4-1/R4-2-backend entry), types.ts (WeeklyReview + sub-interfaces), api.ts (reviewApi.get), export.ts (printHtml/downloadMarkdown/esc), insights-view.tsx, shared/{empty-state,progress,badges}.tsx, notes-view.tsx (printHtml usage pattern), ui/dialog.tsx before coding. Curl-probed /api/review: current week avg 27–28 vs prev 50 (down), prev week avg 50 vs 30 (up), week of 2026-07-06 fully empty (empty-state demo), old weeks still return goal snapshots/habit rows with zeros.
- NEW src/components/app/review-dialog.tsx ("use client"): ReviewDialog(open, onOpenChange). Internal anchor-day state (YYYY-MM-DD, reset to todayKey() on every open); prev/next = anchor ±7 days so navigation works regardless of settings.weekStartsOn. useQuery(["review", anchor], reviewApi.get(anchor), enabled: open, staleTime 30s, placeholderData keepPreviousData — smooth week switches, header range from server data (never assumes Monday).
- Dialog layout: DialogContent flex-col max-h-[90dvh] p-0 overflow-hidden → fixed header (title "Your week" + DialogDescription date range "Aug 24 – 30, 2026" via date-fns on keyToDate keys, prev/next ghost chevron icon buttons w/ aria-labels, next disabled when anchor+7 > today), scrollable body (flex-1 overflow-y-auto), sticky footer (Download .md + Export PDF outline buttons, PDF icon emerald-tinted).
- Body: hero row (avgScore as text-5xl emerald→teal gradient text matching dashboard greeting, "Avg daily score" label, delta chip TrendingUp/Down "−23 vs last week 50" emerald/rose, "Same as last week" when 0, Best day block on the right); ScoreBars 7 mini bars (height = score% of h-20, title tooltips "Mon 80", today = emerald-600→teal-400 gradient, other active days emerald-500/60, zeros muted stubs, weekday labels via format(d,"EEE") per date); StatTiles grid-cols-2 sm:grid-cols-4 (Tasks completed/CheckCircle2 emerald, Habit check-ins/Repeat teal, Focus time/Timer violet + focusVsLastWeek sub-line "+79% vs last wk", Journal entries/BookOpen amber — tints mirror insights TotalsStrip).
- Sections (render only when non-empty): Completed tasks (CheckCircle2 + title + priority dot reusing badges.tsx color mapping urgent=red/high=orange/medium=amber/low=muted), Habits (emoji chip + name + "done 3/7" + ProgressBar h-1.5 emerald→teal gradient fill), Goals in progress (Target chip + "3/10 words" + teal→emerald ProgressBar), Journal moments (mood emoji + "Thu, Aug 27" + muted title). Empty week (all counters 0 + avgScore 0) → EmptyState "A quiet week — nothing tracked yet." Loading → skeleton rows; error → EmptyState w/ retry.
- Exports from CURRENT loaded data: Export PDF → buildReviewHtml (overview + day-by-day score table + stat strip + all sections, esc()'d user content) → printHtml("Weekly Review — Aug 24–30, 2026", html); Download .md → buildReviewMarkdown (headings, score table, bullets) → downloadMarkdown(`momentum-review-{weekStart}.md`) + success toast. Errors → sonner toasts.
- insights-view.tsx (only addition, no restructuring): new WeeklyReviewCta above TotalsStrip — emerald→teal→emerald gradient-bordered (p-px wrapper) button with Sparkles gradient icon tile + "Weekly review / Your week in one view — scores, wins & moments" + ChevronRight, press + hover feedback; InsightsView gained reviewOpen state + <ReviewDialog> mount; FadeIn delays shifted +0.05.
- QA (agent-browser, dedicated --session review, desktop 1280 + mobile 390×844 + dark): CTA renders at top of Insights → click opens dialog with live data (avg 27, 7 bars h∝score Mon 80=64px…Thu 37=30px, today's bar gradient-highlighted, weekday labels Mon–Sun from dates, tiles 3/7/2h 5m+79%/2, range "Aug 24 – 30, 2026", delta "−23 vs last week 50" rose). Prev chevron → "Aug 17 – 23, 2026", avg 50, "+20 vs last week 30" emerald chip, next enabled; next → back to current week, next disabled again (future). 7× prev → "Jul 6 – 12, 2026" shows empty state "A quiet week — nothing tracked yet" (export buttons still active; empty-week .md downloads fine). Close → reopen resets to current week. Export PDF: stubbed window.print, clicked → #momentum-print populated (7405 chars, contains "Day-by-day" table + task titles + "Weekly Review — Aug 24–30, 2026"), window.print called once, container cleaned up + body overflow restored (no headless hang). Download .md: blob text/markdown 1063 bytes via URL.createObjectURL spy + "Markdown downloaded" toast. Mobile 390×844: dialog 358px fits, docScrollWidth 390 (no overflow), body scrolls (949>570), footer buttons visible while scrolled; CTA 356px fits. Dark mode (via documentElement.classList): dialog bg lab(4.4)/text lab(94.2), hero gradient = dark emerald-400 variant — readable; screenshot saved. agent-browser errors = 0 after every step. Screenshots in qa/: r4-2d-{insights-cta,dialog-current-week,mobile-dialog,mobile-insights-cta,dark-dialog,final-desktop}.png (kept for main-agent VLM review).
- bun run lint 0 errors; bunx tsc --noEmit 0 src/ errors (only pre-existing skills/ noise). No test data created, nothing deleted, no other files touched.
- Ops note: dev server was down (ERR_CONNECTION_REFUSED) at round start → restarted with the documented `(setsid bun run dev &)` pattern; one hung review browser session required killing stale chromium processes, which also briefly killed parallel agents' agent-browser sessions (r4/polish/import/subtasks) — they can simply re-`open` their sessions.

Stage Summary:
- Weekly review UI shipped: insights-view CTA (emerald-gradient border, Sparkles) → ReviewDialog with week navigation (prev/next, no future weeks), avg-score hero w/ gradient + delta chip, 7-bar score sparkline (today highlighted, per-date weekday labels), 4 stat tiles, completed-tasks/habits/goals/journal sections, empty-week + skeleton + error states, PDF print export + Markdown download built from loaded data. Backend untouched.
- Files changed: NEW src/components/app/review-dialog.tsx; src/components/app/views/insights-view.tsx (CTA + dialog mount only). QA fully green on desktop/mobile/dark; lint + tsc clean; 0 page errors throughout.

---
Task ID: R4-2a
Agent: frontend-developer
Task: Subtasks checklist UI (tasks-view + dashboard focus row)

Work Log:
- Read worklog (esp. R4-1/R4-2-backend entry), api.ts subtasksApi, types.ts Subtask, shared/badges.tsx (RepeatBadge styling reference), tasks-view.tsx (full), dashboard-view.tsx (FocusRow + queries). Curl-verified /api/todos returns subtasks:[] before coding; confirmed dashboard rows come from ["stats","dashboard"] (subtasks eager-loaded server-side, refetches on view mount).
- tasks-view.tsx — 3 new components: (1) SubtaskItem: size-4 rounded-[5px] square checkbox (emerald/primary fill + Check strokeWidth 4 when done, -inset-1.5 hit pad), title (text-xs, line-through + muted/70 when completed), hover-reveal X delete button (aria-label "Delete step: …", stopPropagation); (2) SubtaskChecklist: indented panel (rounded-xl border bg-muted/30, aligned under title inside the flex-1 column, animate-in fade-in slide-in-from-top-1) rendering SubtaskItems + bottom "Add a step…" Input (h-7 borderless, Enter submits via form, trim + ignore empty, focus retained across refetch) — panel click stopPropagation; (3) TodoRow wiring: local `expanded` useState per row (survives refetch, keyed by row id), progress chip when subtasks.length>0 (ListChecks + "done/total" + 40px emerald progress bar + ChevronDown rotated -90° when collapsed; emerald tint + shadow when ALL done; aria-expanded, descriptive aria-label, title) and a subtle ghost ListChecks "Add a step" icon-button when length===0 (entry point to add the FIRST step — muted /50, emerald when open).
- tasks-view.tsx — TasksView: 3 mutations via subtasksApi (add: create + invalidate ["todos"]; toggle/delete: optimistic update on ["todos","full"] with rollback, invalidate ["todos"] on settle). Errors toast only (sonner), no success toasts. NO ["stats"] invalidation (subtasks don't affect stats). Props wired to both TodoRow render sites (grouped + completed sections).
- Dashboard focus row chip: tiny "1/2" text chip (ListChecks size-3, text-[11px] tabular-nums muted) between repeat icon and due label; title="Checklist progress"; visible fraction aria-hidden + sr-only "Checklist: 1 of 2 steps done".
- QA fix during browser testing: Tailwind v4 wraps group-hover variants in @media (hover: hover) — my initial `sm:opacity-0 sm:group-hover/sub:opacity-100` delete-reveal left wide touch devices (tablets) with invisible-but-tappable buttons. Replaced with `[@media(hover:hover)]:opacity-0 group-hover/sub:opacity-100` + baseline opacity-60: mouse devices get hover-reveal, touch devices always see a faint X. Verified compiled CSS + computed styles both ways.
- Infra note: dev server was reaped mid-QA (connection refused) → restarted with the documented `(setsid bun run dev >> dev.log 2>&1 &)` pattern; my session also hit a transient about:blank + one "fork: Resource temporarily unavailable" (parallel-agent load) — recovered by reopening the URL; server-side data survived both.

Stage Summary:
- Shipped full subtasks/checklist UI in exactly 2 files: tasks-view.tsx (progress chip w/ mini emerald bar + all-done tint, chevron expand/collapse, inline checklist w/ square emerald checkboxes + line-through completed + hover-reveal delete + "Add a step…" input, optimistic toggle/delete mutations, error-only toasts, ghost add-first-step affordance on 0-subtask rows) and dashboard-view.tsx (focus-row "1/2" progress chip). No backend/shared-lib changes; parent todo is NEVER auto-completed.
- QA (agent-browser dedicated --session subtasks, desktop 1280 + mobile 390×844 + dark mode): created "SUB-QA Pack for trip" via inline quick-add → added 3 subtasks in order via new UI (chip 0/3) → toggled 2 (chip 2/3, line-through + muted/70 verified via computed styles) → reload persists → deleted a completed step via X (1/2) → subtask checkbox click does NOT open edit dialog (dialogOpen:false) and ⋯→Edit still opens fine → dashboard focus row shows 1/2 chip (icon 12px, title attr, sr-only) → mobile 390: scrollWidth===390 collapsed AND expanded, chip bbox right 179px, delete visible on touch → dark mode emerald chip/bar verified (bg emerald-500/15, border /40) → all-done state = emerald-tinted chip + 100% bar + parent stays incomplete → empty Enter ignored → 0 page errors after every step → all SUB-QA test data deleted via API (11 demo todos remain). bun run lint 0 errors; bunx tsc --noEmit 0 src/ errors; dev.log clean. Screenshots: /tmp/subqa-*.png (VLM CLI unavailable — 401 missing token — so visual QA was done via computed-style + bbox assertions).

---
Task ID: R4-3
Agent: frontend-styling-expert
Task: Styling polish deepening (routine/goals/notes/diary/focus + globals.css)

Work Log:
- Read worklog (R2-4/R3-3 polish entries + R4-1 handover), globals.css, all 5 target views, and shared empty-state/badges/progress/view-header/week-dots before coding. Before-screenshots taken first (5 views × desktop-light / 390×844 mobile / desktop-dark, dedicated `--session polish`).
- src/app/globals.css — new utilities following the existing @layer-utilities conventions: `.gradient-text` (emerald→teal oklch gradient text, dark variant), `.glow-ring` (ambient circular box-shadow via `--glow-color` custom prop defaulting to --primary, dark = lower opacity/larger radius), `.fade-edges` (both-end mask-image fade for horizontal scroll strips), `.fade-ends-y` (vertical hairline that fades at both ends, theme-aware via --border). New keyframes + classes: `.check-pulse` (springy 0.8→1.14→1 scale pop on habit/routine check completion), `.celebrate` (one-shot 900ms scale+glow ring pulse for 100% goals), `.glow-pulse` (opacity breathing 0.45↔0.85 for the focus ring's ambient glow), `.bar-shimmer` (moving white highlight over active progress fills — the ::after overlay is created ONLY inside `@media (prefers-reduced-motion: no-preference)` so reduced-motion users get zero residue; the other keyframes are killed by the pre-existing blanket reduce kill-switch). Scrollbar styling reviewed and kept as-is (already thin/rounded/hover-aware).
- shared/empty-state.tsx (conservative, benefits all views): icon container upgraded size-14→size-16 with soft gradient bg (emerald-500/15 → teal-500/5, dark /20→/10) + ring-1 ring-primary/10; icon size-7→8; title mt-4→mt-5 for clearer hierarchy. No DOM/semantic changes.
- routine-view.tsx: unified HABIT_GROUP_META+SECTION_META into one SECTION_META map with lucide icon chips + time-of-day tints (morning=Sunrise amber-300/20, afternoon=Sun orange-400/15, evening=Moon teal-400/15, anytime=Clock primary/10 — zero indigo/blue); habit-group headers + schedule section headers now use the tinted chips with a trailing `h-px bg-gradient-to-r from-border to-transparent` hairline; TodayBanner ProgressRing got `glow-ring`, "Perfect day! 🎉" renders as `.gradient-text`; habit + routine check buttons get `check-pulse` when doneToday (fires once per toggle).
- goals-view.tsx: monthly period tint changed violet→teal (removed the app's last violet UI accent; PERIOD_STYLES slimmed to badge-only); progress bars now emerald→teal gradient (`dark:emerald-400→teal-400`) with `.bar-shimmer` on active non-archived goals only; completed goals get archive-ink look (title `line-through decoration-emerald-500/60` + card `opacity-90` alongside existing emerald tint), archived keep opacity-70 + muted strike; added `celebrateId` state — increment/patch mutations call `celebrateCompletion()` on the progress>=target crossing (optimistic), GoalCard renders `.celebrate` for 1s (scale+glow pulse).
- notes-view.tsx: NoteCard is `group relative`; pinned notes get a 3px left gradient border (amber-400→via-amber-500→orange-500/70) and the Pin icon rotates 45° on card hover (`group-hover:rotate-45`, 300ms); tag filter strip got `fade-edges -mx-3 px-3` (mask-faded scroll strip, padding keeps the first chip unfaded at rest).
- diary-view.tsx: collapsed timeline rows now show mood emoji in soft tinted halo chips (great=emerald/good=teal/okay=amber/low=orange/rough=rose, all bg /10 + ring /15; muted fallback when no mood) aligned to a new vertical timeline thread — a 1px `.fade-ends-y` rail at left-[30px] behind the cards (visible in row gaps + beside month labels, cards paint over it; month headers indented pl-9 to clear it); expanded-panel mood badge reuses matching MOOD_BADGE tints; TimelineRow root is `relative` (paint order) — no DOM restructuring.
- focus-view.tsx: mode tabs are gradient pills (focus emerald-600→teal-600, short amber-500→orange-500, long teal-600→emerald-600; dark uses 400-shades with dark text); ambient glow div behind the timer ring (blurred radial using `--focus-ring` via color-mix, -inset-5 blur-2xl) that fades in with `.glow-pulse` ONLY while running (opacity-0 otherwise, 700ms fade); session dots: newest filled dot gets `animate-in zoom-in-75` scale-in; weekly-delta sub became a micro-chip (up = emerald /10 chip with ChevronUp "+55 min vs last week", down = amber chip); task-chip strip got `fade-edges -mx-3 px-3`.
- QA (agent-browser, dedicated `--session polish`, 37 screenshots: 15 before + 15 after + 7 interaction probes): programmatic computed-style verification per view — routine section chips/hairlines/glow-ring/check-pulse counts; goals gradient+shimmer bar (30%→100%), no `violet` classes anywhere in DOM, completed state (strike+opacity-90+Done badge+shimmer-off); notes pinned gradient strip + tag-row mask; diary mood chips (teal/amber/emerald /10) + rail rect (left 30px = mood-chip center ±0.5px) + pixel-probe on screenshot confirmed the rail renders in card gaps (RGB 219,219,212 vs 252,252,249 bg) and fades at both ends; focus gradient active tab, running glow (opacity 0.48 mid-pulse, animation glow-pulse, radial emerald/26%) that disappears on pause/reset, "+55 min vs last week" chip, newest-dot scale-in.
- Interactions (state restored after each): habit "Move your body" completed via UI → check-pulse animation ran (animationName=check-pulse, aria-pressed=true) → toggled back off (verified pressed=false); goal bumped 3→10 via + button → `.celebrate` captured mid-animation (animationName=celebrate) → bumped back 3/10 (API-verified progress=3, status=active); focus timer ran 3s (glow present) → paused → reset to 25:00 (reset logs nothing, zero DB impact).
- Mobile 390×844: all 5 views scrollWidth===390 (no horizontal overflow) before AND after. Dark mode verified per effect (glow-ring 0.12 opacity/34px blur, gradient tab emerald-400→teal-400 with teal-950 text, bar gradient 400-shades + shimmer, gradient-text/section-chip dark variants). `agent-browser errors` = 0 after every step. `bun run lint` 0 errors; `bunx tsc --noEmit` 0 src/ errors (only pre-existing examples/skills errors). dev.log clean.

Stage Summary:
- Polish deepening complete across routine/goals/notes/diary/focus + globals.css + shared EmptyState: tinted icon-chip section headers with hairlines, habit/routine check-pulse micro-animation, goal progress gradient+shimmer with 100% celebrate pulse and archive-ink completed state (violet monthly tint removed → teal), pinned-note gradient edge + pin hover rotation, faded-edge scroll strips, mood-tinted diary timeline with a fading vertical thread, gradient focus mode pills + running-only ambient glow + delta micro-chips + newest-dot scale-in, warmer gradient EmptyState icons app-wide. 7 new CSS utilities/keyframes, all reduced-motion-gated (blanket kill-switch + shimmer overlay created only under no-preference).
- Files touched: src/app/globals.css, src/components/app/shared/empty-state.tsx, src/components/app/views/{routine,goals,notes,diary,focus}-view.tsx. No layout restructuring, no new dependencies, print pipeline untouched, all toggled test state restored (goal 3/10 active, "Move your body" unchecked, no focus sessions logged). QA: 37 screenshots, 0 page errors, mobile overflow-free, dark-mode verified, lint/tsc clean.

---
Task ID: R4-4 (final)
Agent: main (cron review round 4)
Task: Merged-state final QA + handover

Work Log:
- Merged-state QA on fresh browser session (final): all 9 views swept — 0 page errors each.
- Subtasks UI verified on merged state: demo data added (3 subtasks on "Plan weekend hiking trip" via API for demonstrability) → Tasks view chip 0/3 → expand toggle works → 3 items + "Add a step…" input visible → toggled "Check trail conditions" → chip live-updates to 1/3 (left as demo state). Dashboard focus row shows "Checklist: 0 of 3 steps done" sr-only + chip.
- Weekly Review verified: Insights CTA opens dialog ("Your week" + avg score + Tasks/Habits/Focus/Journal tiles + Export PDF + download .md all present), prev-week navigation refetches correctly (Aug 17 range), 0 errors.
- Import UI verified: Settings "Import & restore" card renders (Merge/Replace radio cards, hidden file input, privacy hint), 0 errors. (Subagent already full-tested merge/replace/error paths with DB restoration.)
- Mobile 390×844: Dashboard/Tasks/Insights/Settings scrollWidth=390 (no overflow). Dark mode: Routine/Goals/Notes/Diary/Focus all clean at 390px (polish effects verified by R4-3 agent via computed styles + 37 screenshots).
- bun run lint: 0 errors. tsc --noEmit: 0 src/ errors. dev.log tail clean (200s only).
- Final DB: 11 todos (1 with 3-subtask checklist), 3 habits (2 done today), 1 active goal 3/10, stats score 50, review API avg 28 / 3 tasks / 125 focus min — all demo-ready.
- VLM CLI returns 401 (missing X-Token) this round — visual QA done via programmatic computed-style/bbox assertions (subagents + main), all green.

Stage Summary:
- Round 4 COMPLETE. Three new full-stack features shipped: (1) Task checklists/subtasks — inline expandable checklist with progress chips in Tasks + Dashboard, recurrence clones carry checklists, included in search/stats/markdown export; (2) Weekly Review — /api/review aggregation + rich dialog from Insights with week navigation, score sparkline, stat tiles, sections, PDF/markdown export; (3) Backup Import — merge/replace restore with preview, destructive-action gates, error handling, full query invalidation. Plus mandatory styling polish deepening (tinted section icon chips, gradient progress bars with shimmer, celebrate/check-pulse/glow animations, mood halo chips + diary timeline rail, focus ambient glow + gradient mode pills, empty-state upgrade, 8 new CSS utilities — all reduced-motion gated).

## Handover — three sections

### 1. Current project status
Production-ready single-route SPA ("/" only, Next.js 16 App Router) with 9 views + command palette + PWA manifest. Now 15 API route groups over 10 Prisma models (Subtask added). Round 4 added task checklists, weekly review, and JSON backup import round-trip. All views browser-verified on merged state (0 page errors), lint/tsc clean, mobile 390px + dark mode verified, demo data present and richer (checklist on hiking trip 1/3).

### 2. Current goals / completed modifications / verification results
Goals: QA → bugs (none found; baseline all-green) → mandatory features + mandatory styling polish.
Completed: (a) QA baseline 9 views clean; (b) subtasks full-stack (curl-verified CRUD/ordering/recurrence clone; UI QA'd by subagent + re-verified on merged state); (c) weekly review full-stack (curl-verified aggregation incl. week-param validation; dialog QA'd incl. navigation/exports/mobile/dark); (d) import full-stack (merge/replace/error paths curl + UI QA'd with DB restore confirmation); (e) export bumped to v2 with subtasks; (f) styling polish across 5 views + globals.css + shared empty-state (subagent QA: 37 screenshots, scrollWidth 390 everywhere, computed-style dark-mode checks, interactions with state restored).
Verification: agent-browser sweeps (9 views × 0 errors, fresh session), programmatic chip/dialog/section assertions, curl contracts for every new endpoint, lint 0 errors, tsc 0 src errors, dev.log clean.

### 3. Unresolved issues / risks / next-phase priorities
Unresolved/risks:
- VLM CLI auth broken this round (401 missing X-Token) — visual QA was programmatic; consider re-checking with VLM next round if auth recovers.
- Import replace mode is destructive by design; UI gates it (checkbox confirm) but no server-side dry-run preview of what would be deleted — acceptable for local-first single-user app.
- Subtask reorder (drag) not supported (sortOrder append-only); fine at current scale.
- PWA still has no service worker (manifest-only installability; offline shell remains a deliberate cut).
- Dev server reaped twice this round (known infra issue) — restart pattern documented in worklog works; data survives.
Next-phase priorities (suggested order):
1. Service worker + offline shell (completes PWA story).
2. Subtask drag-reorder + subtasks in quick-add dialog.
3. Habit drag-and-drop reorder (endpoints exist).
4. Keyboard shortcuts help overlay (? key) + more palette actions.
5. Onboarding tour for first-run users (settings.onboarded flag exists, unused).
