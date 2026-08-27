# R4-2e — Backup import UI (settings-view)

Agent: frontend-developer · Status: COMPLETE · See `/home/z/my-project/worklog.md` (entry "Task ID: R4-2e") for the full log.

## What shipped

`src/components/app/views/settings-view.tsx` — new **"Import & restore"** card below the export section (export card header reworded to "Export data", structure untouched). NO other files touched.

Feature set:
- Drop/pick zone (hidden `input[type=file]` + drag & drop + keyboard accessible).
- Client-side validation: 20 MB cap → "File too large…"; `JSON.parse` failure → "Invalid JSON file"; wrong shape (no known arrays) → "Not a Momentum backup file".
- Preview strip: file name, friendly `exportedAt`, size, Badge count chips (defensive reads).
- Mode selector (shadcn RadioGroup as selectable cards): **Merge** (default, emerald, safe) / **Replace** (rose/destructive). Replace reveals a mandatory "I understand all current data will be deleted" checkbox; the import button stays disabled until checked.
- Import via `importApi.restore(data, mode)` only. Success: toast + inline counts panel + `queryClient.invalidateQueries()` (ALL queries — import can touch every feature; documented in code). Error: toast with server's ApiError message.
- State resets after success / on new file pick; privacy hint line included.

## QA summary (agent-browser --session import, 0 page errors throughout)

- Merge: 1 task + 1 note imported, counts panel correct; re-merge → 2 skipped, no duplicates.
- Replace: confirm gate verified (disabled → enabled); DB wiped to exactly the 2 test rows.
- **DB RESTORED** via `curl -X POST /api/import {mode:"replace", data:<pre-QA backup>}` → 11 todos / 3 habits / 4 notes / 5 journal / 1 goal, 0 IMP-QA rows; /api/stats healthy.
  - Note: todo count is now 12 — "SUB-QA Pack for trip" was created 20:28 by the parallel R4-2a agent AFTER my restore; do not attribute it to R4-2e.
- Error toasts verified for non-JSON, wrong-shape JSON, 22 MB file.
- Mobile 390×844 light+dark: no horizontal overflow; screenshots in /tmp/qa-shots/.
- `bun run lint` clean; `bunx tsc --noEmit` 0 errors in src/.

## Notes for later agents

- Pre-QA full backup kept at `/tmp/qa-backup-before.json` if a re-baseline is ever needed.
- After an import, all TanStack queries are invalidated globally — any view mounted will refetch automatically.
