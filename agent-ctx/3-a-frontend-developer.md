# Task 3-a — Frontend: Dashboard view + Tasks view

Agent: frontend-developer
Date: 2026-08-27 (sandbox clock)
Full work record: see `../worklog.md` → "Task ID: 3-a" section (authoritative).

## Files changed
- `src/components/app/views/dashboard-view.tsx` — replaced stub with full `DashboardView` (spec'd in task).
- `src/components/app/views/tasks-view.tsx` — replaced stub with full `TasksView`.
- `src/lib/notifications.ts` — OUT-OF-SCOPE minimal crash fix (undefined `last` at line 100 crashed the app whenever a todo was due today past 9 AM). Documented in worklog.
- `worklog.md` — appended Task 3-a record.

## Key conventions discovered (important for other frontend agents)
1. **Query key ownership**: `["todos","all"]` is owned by notification-engine/bell-menu with `queryFn: status "active"`. Registering a different queryFn under the same key makes the LAST mounted observer's fetcher win (TanStack v5) — that would corrupt the bell menu's data. Full-list consumers must use a different key (I used `["todos","full"]` with a queryFn that fetches active + completed in parallel and merges) and invalidate with the `["todos"]` prefix.
2. **api.ts `list({status:"all"})` sends NO status param** and the backend then returns ACTIVE-ONLY. Verified via curl: `/api/todos` → active only; `/api/todos?status=all` → everything. Workaround: fetch both halves explicitly.
3. **Client-side day keys**: derive via `dateToKey(new Date(iso))` (local timezone), never `iso.slice(0,10)` (UTC).
4. **Sticky positioning**: mobile app-header is ~65px — use `top-16 lg:top-0` for sticky elements that must sit under it; desktop has no top bar.
5. Stats mutations should invalidate `["stats"]` and `["todos"]` / `["habits"]` prefixes so dashboard + engine caches stay coherent.

## Verification performed
- `bun run lint` → 0 errors. `tsc --noEmit` → no errors from my files.
- Headless browser (agent-browser) end-to-end: onboarding card, starter-habits mutation, habit/todo optimistic toggles (persisted in API), quick add (Enter + button), priority/due cycling, day grouping incl. red overdue tint, edit dialog (incl. date+time combine → "Today · 2:30 PM" and clearing → null), delete + clear-completed dialogs, all tabs, category chips, empty states, mobile 390×844 and desktop 1280×900.
- dev.log clean after changes.

## State left behind
- DB contains demo data (3 starter habits — the onboarding ones — plus 1 task "Reply to Sarah's email about the project" due today 5 PM, high priority, with notes) so the preview shows a populated dashboard.
