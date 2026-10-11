# Testing & Acceptance Checklist — Gokul Gruh Udhyog

This document maps the master-prompt acceptance criteria to how each is verified.
Items marked ✅ were verified automatically against the running server during
development; items marked 🔎 are manual UI checks to perform in a browser.

## Automated verification (already run)

These API-level flows were exercised against the running server and passed:

| # | Check | Result |
|---|-------|--------|
| 1 | Unauthenticated `GET /api/orders` is rejected | ✅ `401` |
| 2 | Login with seeded admin sets a session | ✅ returns admin |
| 3 | Create draft order | ✅ stable `id`, status `DRAFT` |
| 4 | Autosave + finalize (name/phone/address/type/docket) | ✅ status `COMPLETE`, `version` incremented |
| 5 | Phone normalization | ✅ `9876543210` → `+919876543210` |
| 6 | Weekday derivation from business date | ✅ `2026-10-11`→Sunday, `2026-10-10`→Saturday |
| 7 | List by date | ✅ returns saved record |
| 8 | Today summary counts | ✅ totals/drafts/complete/lastSaved |
| 9 | Duplicate docket detection | ✅ returns matches for `1021` |
| 10 | Finalize with invalid phone | ✅ `400` (rejected, input preserved) |
| 11 | Optimistic concurrency (stale version) | ✅ `409 Conflict` |
| 12 | Soft delete removes from list | ✅ excluded, audit event written |

Re-run quickly with the server up (`npm run start`):

```bash
# login -> cookie jar
curl -s -c cj.txt -X POST localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@gokulgruh.local","password":"<your pw>"}'
# create + autosave
curl -s -b cj.txt -X POST localhost:3000/api/orders -H 'Content-Type: application/json' -d '{}'
```

## Manual UI checklist (browser)

- 🔎 **Test 1 — Admin access:** Visit `/notebook` while logged out → redirected
  to `/login`. Log in → notebook. Log out from the profile menu → back to login.
- 🔎 **Test 2 — Create an order:** Click **Add New Entry**, type into the row.
  Date + weekday populate from the selected date. No Save click needed.
- 🔎 **Test 3 — Autosave reliability:** Enter fields gradually; watch the status
  go **Draft → Saving → Saved** with time. Refresh the page — data persists.
  (Throttle/offline in DevTools → status shows **Save failed** with Retry, never
  a false "Saved".)
- 🔎 **Test 4 — Automatic rows:** Press **Enter** on the Docket field of the last
  row → a new empty row is created and focused. Each row keeps a unique id; no
  duplicates created while typing.
- 🔎 **Test 5 — Copy/paste:** Click **Paste**, paste tab-separated rows from a
  spreadsheet (or upload a CSV). Confirm column mapping, preview, validation
  counts, then import. Re-submitting the same import does not duplicate.
- 🔎 **Test 6 — History:** Create records on different dates; in **Order History**
  filter by exact date / range and search by name/phone/docket/type. Open an
  older order — business date + weekday are correct.
- 🔎 **Test 7 — Preview:** Click the **eye** icon on a record → the side panel
  shows that order's slip with correct details and branding (no cross-record
  mixing).
- 🔎 **Test 8 — Download image:** In the preview, click **Download Image** →
  a `GokulGruhUdhyog_Order_<docket>.png` downloads at **1200 × 1800**. Long
  names/addresses wrap without clipping.
- 🔎 **Test 9 — Printing:** Click **Print** → the browser dialog shows only the
  4×6in slip (no app chrome). Set printer media to 4×6in for physical output.
- 🔎 **Test 10 — Contact page:** `/contact` shows contact person, phone (tap to
  call via `tel:`), copy-number, editable address, and the map (or fallback link
  when no Maps key / address). Check on a narrow viewport.
- 🔎 **Test 11 — Responsive:** Check mobile (375px), tablet (768px), desktop.
  Sidebar becomes a drawer; notebook rows become cards; nothing overflows.
- 🔎 **Test 12 — Security:** Confirm API routes return `401` without a session,
  the service-role/DB is never exposed to the client, and `.env` secrets are not
  bundled (only `NEXT_PUBLIC_*` reach the browser).

## Accessibility spot-checks

- Keyboard: `Ctrl/⌘ + K` focuses search; `Enter` advances fields; `Esc` closes
  dialogs/preview. Visible focus rings throughout.
- Save status uses icon + text (never color alone).
- `prefers-reduced-motion` disables animations.
