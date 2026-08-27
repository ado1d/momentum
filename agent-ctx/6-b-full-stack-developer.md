# Task 6-b — Mood month heatmap ("Mood calendar" card)

Agent: full-stack-developer · Round 6, batch 1 · Files owned: `diary-view.tsx`, `api/journal/route.ts`, `journalApi` block of `api.ts`, journal types (untouched — reused `JournalEntry`).

## What shipped
1. **Backend** `GET /api/journal?month=YYYY-MM` (optional, zod regex `^\d{4}-(0[1-9]|1[0-2])$`): returns that calendar month only (date gte `MM-01` / lte last day via `new Date(y, m, 0).getDate()` — local-safe), **date ASC**, `limit` ignored. Month absent → legacy behavior byte-identical (limit, DESC). Empty `month=` treated as absent (same convention as limit).
2. **api.ts** — `journalApi.month(monthKey)` added inside the journalApi block ONLY (encoded query param). Nothing else in api.ts touched.
3. **diary-view.tsx** — `MoodCalendarCard` component (same file), rendered above the timeline:
   - Header: CalendarDays icon in emerald-tinted chip (R4-3 chip convention) + "Mood calendar" + "Your month in colors"; right: month label (aria-live) + ghost chevron buttons (aria-labels "Previous month"/"Next month"). Next disabled at current month; prev capped 12 months back (string compare on YYYY-MM).
   - Grid: custom 7-col grid (NOT the ui Calendar) — weekday letters rotate with `settings.weekStartsOn` (verified live for both 0 and 1); leading invisible placeholders for out-of-month alignment; 43–45px aspect-square cells (grid capped `max-w-[336px]`).
   - Entry cells: solid mood fill (great=emerald-500/80, good=teal-500/80, okay=amber-500/80, low=orange-500/80, rough=rose-500/80, white day number, ring-1 ring-black/5, hover:brightness-110), `title` = `Thu, Aug 27 — Good`, click → reuses existing `openDay` flow (loads entry into the inline editor + scrolls top). Mood-less entries → neutral `bg-foreground/20` fill, still clickable.
   - Empty in-month cells: `bg-muted/40`, muted number, div with aria-disabled + cursor-default. Today: `ring-2 ring-primary ring-offset-1 ring-offset-background` (twMerge correctly replaces the entry cell's ring-1). Future days (current month only, by construction): opacity-50.
   - Legend: 5 solid dots + labels (Great/Good/Okay/Low/Rough, text-[11px] muted) + right "N entries this month" (emerald semibold number). Wraps gracefully at 390px (count drops under dots).
   - Query: `useQuery(["journal","month",monthKey], journalApi.month, { placeholderData: keepPreviousData })` — keeps prior data during refetch (no empty flash on save/delete invalidation); grid dims (opacity-60 + aria-busy) while fetching. Existing `["journal"]` prefix invalidations from save/delete mutations automatically refetch the month query. Timeline's own `["journal"]` query untouched.
   - Empty month (0 entries): grid still renders (July 2026 verified), "0 entries this month", no EmptyState. Entrance: single `.view-enter` on the card (no per-cell stagger).

## Verification (agent-browser session `diary6`, today = 2026-08-27)
- **Curl**: `month=2026-08` → 5 entries ASC (19,21,23,26,27 · great,okay,good,good,good); `month=2026-07` → `[]`; `month=2026-13`/`august`/`2026-8` → 400 `{"error":"Validation failed — month: Month must be in YYYY-MM format"}`; legacy `limit=50` and no-param → identical to pre-change baseline (5, DESC); `month+limit` → month wins (ASC, 5).
- **UI**: label "August 2026"; weekday header M T W T F S S (weekStartsOn=1; also verified S-first after PATCHing settings to 0, then restored to 1); 43 grid kids (7 header + 5 blanks + 31 days); 5 entry cells with correct titles + mood color classes; today (27) ring-primary + ring-offset, ring-1/ring-black/5 dropped by twMerge; future 28–31 opacity-50; legend 5 dots + labels; "5 entries this month" (emerald span).
- **Click-to-edit**: clicked Aug 19 cell → inline editor loads "Feeling in control of my week", date label "Wed, Aug 19", mood Great pressed, scrolled to top.
- **Navigation**: prev → "July 2026" (empty grid renders, 0 entries, aria-disabled cells); walked back to the 12-month floor "August 2025" → prev disabled; forward 12 clicks → "August 2026", next disabled, 5 cells restored. Network log shows a real `GET /api/journal?month=…` per navigation.
- **Probe (via UI, on Aug 25 — today already had an entry; probing today would have UPSERT-overwritten the demo entry, so an empty day was used)**: editor date → Aug 25 (next-day ×6), mood Low, title "Probe entry 6b", Save → toast "Diary saved", orange `bg-orange-500/80` cell at 25 (title "Tue, Aug 25 — Low"), count → 6. Delete via timeline kebab → AlertDialog → "Entry deleted", cell reverted to muted/aria-disabled, count → 5. DB re-checked by curl: exactly the original 5 demo entries remain — zero probe data.
- **Mobile 390×844**: scrollWidth === 390, no overflow, cells 43×43, legend wraps gracefully. **Dark mode** (mobile): entry cells keep white text on solid mood fills, muted cells readable, count emerald-400, dots visible, no overflow; screenshot /tmp/diary6-dark.png (+ diary6-mobile.png, diary6-desktop-light.png).
- **Regression sweep**: Dashboard → Tasks → Diary, 0 page errors, 0 console errors, R5 features untouched (no file overlap).
- `bun run lint` → 0; `bunx tsc --noEmit` → 0 src/ errors (only pre-existing examples/skills); dev.log tail clean 200s. VLM CLI still 401 — visual QA programmatic (computed styles + classList), consistent with prior rounds.

## Risks / notes
- keepPreviousData means the legend count can show the previous month's total for a few ms while the new month fetches (local SQLite → ~10–30 ms, imperceptible; preferred over a muted-flash of the grid).
- Month query is a separate fetch per viewed month (by design, spec'd); the timeline `["journal"]` query is untouched — no double-fetch of the same data shape beyond the spec'd month query.
- Nav floor is "12 months back from the current month" (inclusive) — e.g. from 2026-08 you can reach 2025-08 but not 2025-07.
- Probe used Aug 25 instead of today deliberately (upsert-by-date would have mutated the demo entry; documented in worklog).
