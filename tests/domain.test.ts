import test from "node:test";
import assert from "node:assert/strict";
import {
  summarize,
  seedTrips,
  validateTrip,
  validDay,
  tripDay,
} from "../server/domain.ts";
test("official sample totals and payment breakdown", () => {
  assert.deepEqual(summarize(seedTrips), {
    count: 2,
    revenue: 3900,
    commission: 585,
    takeHome: 3315,
    cash: { count: 1, revenue: 1500, commission: 225, takeHome: 1275 },
    card: { count: 1, revenue: 2400, commission: 360, takeHome: 2040 },
  });
});
test("empty totals are zero", () => {
  assert.equal(summarize([]).takeHome, 0);
  assert.equal(summarize([]).cash.count, 0);
});
test("money uses integer minor-unit arithmetic", () => {
  assert.equal(
    summarize([
      { ...seedTrips[0], amount: 0.1, commission: 0 },
      { ...seedTrips[1], amount: 0.2, commission: 0.1 },
    ]).takeHome,
    0.2,
  );
});
test("day uses Almaty start date, including overnight trip", () => {
  assert.equal(
    tripDay({
      ...seedTrips[0],
      start: "2026-09-30T20:00:00Z",
      end: "2026-10-02T01:00:00Z",
    }),
    "2026-10-01",
  );
});
test("timestamps normalize timezone-equivalent instants", () => {
  assert.equal(
    validateTrip({ ...seedTrips[0], start: "2026-10-01T08:10:00+05:00" }).start,
    seedTrips[0].start,
  );
});
for (const [description, patch] of Object.entries({
  zero: { amount: 0 },
  negative: { amount: -1 },
  string: { amount: "3" },
  fraction: { amount: 1.001 },
  tinyFraction: { amount: 0.0000001 },
  infinite: { amount: Infinity },
  commission: { commission: 2401 },
  negativeCommission: { commission: -1 },
  endBeforeStart: { end: "2026-10-01T00:00:00Z" },
  equalTimestamps: { end: seedTrips[0].start },
  invalidPayment: { payment: "crypto" },
  invalidDate: { start: "2026-02-30T08:00:00Z" },
  missingZone: { start: "2026-10-01T08:00:00" },
  badId: { id: "space id" },
}))
  test(`rejects ${description}`, () =>
    assert.throws(() => validateTrip({ ...seedTrips[0], ...patch })));
test("calendar date validation", () => {
  assert.equal(validDay("2024-02-29"), true);
  for (const day of ["2026-02-29", "2026-13-01", "2026-1-1", "invalid"])
    assert.equal(validDay(day), false);
});
