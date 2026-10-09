# Shiftbook — driver shift diary

A small full-stack implementation of the [arqa recruitment task](https://jobs.arqa.cc/#task): a React + TypeScript client and TypeScript/Node HTTP server. The interface is responsive, keyboard accessible, and includes loading, error/retry, empty-day, and add-trip flows.

## Run locally

Requires Node.js 22.12+ (tested on 24.19) and npm. No account, API key, database service, or environment file is required.

```sh
npm ci
npm run dev
# Open http://127.0.0.1:3000
```

The app opens the sample day **October 1, 2026**, rather than today's date, so the supplied example is immediately visible. Use the date picker or previous/next arrows to change the day.

Production-style run:

```sh
npm run build
npm start
```

Both modes serve the client and API on the same origin. `PORT`, `HOST` (default `127.0.0.1`), and `DATA_FILE` (default `data/trips.json`) can be overridden. A first run creates local persistent data with the two sample trips. Subsequent runs preserve it. To start fresh, stop the app and remove your local data file.

## Verify

```sh
npm run check       # unit/integration tests, strict TypeScript check, production build
npx playwright install chromium
npm run test:e2e    # real Chromium UI checks; starts its own server on port 3100
```

Browser tests use a fresh temporary data directory each run. When they run successfully, they produce `screenshots/desktop.png` and `screenshots/mobile.png`. The browser suite is supplied but was blocked before launch in the implementation environment; see VERIFICATION.md. No browser engine is claimed as verified. On restricted machines, set `PLAYWRIGHT_BROWSERS_PATH` to a writable path for both the install and test commands. System browser libraries may also be required. An existing compatible Chromium can be selected with `CHROMIUM_PATH=/path/to/chromium npm run test:e2e`.

## Completed scope

- Day trips API with total trip count, revenue, commission, take-home, and cash/card breakdown
- Responsive client showing that summary, payment breakdown, and ordered trip history
- Date changes and deterministic seed data
- Add-trip API and optional client form with validation and visible errors
- Retry-safe trip IDs: identical repeated/concurrent requests do not create duplicate records
- File persistence, including reload and invalid-data fail-fast behavior
- Unit/integration tests for official totals, rounding, date boundaries, validation, persistence, and idempotency
- Browser checks for summary, navigation, empty state, modal cancellation, mobile overflow, error/retry, invalid end time, and successful trip creation

## API

### `GET /api/trips?day=2026-10-01`

Returns `{ day, timeZone, trips, summary }`. `summary` contains `count`, `revenue`, `commission`, `takeHome`, and `cash`/`card` objects with the same four totals. Trips are ordered by start instant and then ID. An empty day returns an empty list and zero totals. A missing or invalid date is a `400`.

The supplied sample yields **2 trips, revenue 3900, commission 585, take-home 3315**. Cash gross revenue is 1500; card gross revenue is 2400.

### `POST /api/trips`

```sh
curl http://127.0.0.1:3000/api/trips \
  -H 'Content-Type: application/json' \
  -d '{"id":"my-trip-1","start":"2026-10-01T10:00:00+05:00","end":"2026-10-01T10:20:00+05:00","amount":1000,"payment":"cash","commission":150}'
```

Returns `{ trip, created }`: `201` for new data, `200` for an identical retry, `409` for an existing ID with different details. Field order and equivalent timestamp offsets do not change identity. IDs are the idempotency key; different IDs are separate trips even if all other details match. The client reuses its generated UUID across retries while its form remains open.

Validation: bounded safe IDs; actual ISO calendar timestamps with timezone; end after start; amount positive; commission between zero and amount; `cash` or `card`; monetary values at most two decimal places and at most 1 billion. Timestamps are normalized to UTC. Invalid payloads return `400`; unsupported content type `415`; payloads above 16 KiB `413`; unsupported methods `405`.

## Decisions and limits

- **Day and timezone:** a trip belongs to its start day in `Asia/Almaty` (UTC+5 for the sample). Overnight trips are counted once. The UI explicitly labels this timezone and creates trips using UTC+5. Historic timezone-offset changes are not supported by the entry form.
- **Money:** assumed KZT from the supplied values/timezone and task context. API numbers are major units; calculations sum integer minor units to avoid floating-point accumulation. Take-home is fare minus commission. Payment breakdown is gross fares, not money currently in the driver's possession.
- **Persistence:** a lean JSON store with atomic file replacement and a serialized write queue. A write is acknowledged only after it is saved. This supports a single server process on one local filesystem. It is not a multi-process database or a power-loss durability guarantee. Corrupt existing data stops startup instead of silently resetting it.
- **No production scope added:** no auth, deployment, editing/deletion, pagination, observability service, or multi-driver tenancy. This is a local take-home, not a production service. Do not expose it publicly without adding appropriate authentication, access control, and deployment hardening.
- **Retries:** preserving the form preserves the ID. Closing/reloading the page loses that ID; production offline retries would warrant a persistent client outbox. If the saved trip starts on a different date, navigate to that date to see it.
- **Dependencies:** package-lock.json locks installation. There are no runtime remote fonts or third-party APIs.

## AI assistance disclosure

An OpenAI coding assistant generated the implementation, styling, tests, and documentation, and ran the checks recorded in `VERIFICATION.md`. A second AI review identified edge cases. During verification, the assistant corrected a disappearing success notice, overly permissive sub-cent validation, test-state leakage across runs, and environment-specific runner issues. The candidate has not yet personally reviewed or corrected this generated work; this submission should not imply otherwise. Candidate review and understanding of the implementation remain necessary before presentation.
