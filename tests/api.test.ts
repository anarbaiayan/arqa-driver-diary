import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { TripStore } from "../server/store.ts";
import { apiHandler } from "../server/app.ts";
import { seedTrips } from "../server/domain.ts";
test("API integration: totals, validation, persistence, concurrent idempotency and conflicts", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "shiftbook-")),
    file = join(dir, "trips.json");
  const store = new TripStore(file);
  await store.init();
  const api = apiHandler(store),
    server = createServer((req, res) => {
      void api(req, res);
    });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  t.after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await rm(dir, { recursive: true });
  });
  const post = (body: unknown) =>
    fetch(base + "/api/trips", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  await t.test("GET official sample", async () => {
    const res = await fetch(base + "/api/trips?day=2026-10-01");
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.trips.length, 2);
    assert.equal(data.summary.takeHome, 3315);
    assert.equal(data.timeZone, "Asia/Almaty");
  });
  await t.test("GET empty date", async () => {
    const data = await (await fetch(base + "/api/trips?day=2026-10-02")).json();
    assert.equal(data.summary.count, 0);
  });
  await t.test("GET invalid and missing dates", async () => {
    for (const q of ["", "?day=2026-02-30"])
      assert.equal((await fetch(base + "/api/trips" + q)).status, 400);
  });
  await t.test("POST duplicate sample with equivalent offset", async () => {
    const res = await post({
      ...seedTrips[0],
      start: "2026-10-01T08:10:00+05:00",
    });
    assert.equal(res.status, 200);
    assert.equal((await res.json()).created, false);
  });
  const trip = { ...seedTrips[0], id: "new-trip" };
  await t.test("concurrent repeated POST writes one row", async () => {
    const responses = await Promise.all(
      Array.from({ length: 10 }, () => post(trip)),
    );
    assert.equal(responses.filter((r) => r.status === 201).length, 1);
    assert.equal(responses.filter((r) => r.status === 200).length, 9);
    assert.equal(store.all().length, 3);
  });
  await t.test("same ID different payload conflicts", async () => {
    assert.equal((await post({ ...trip, amount: 3000 })).status, 409);
    assert.equal(store.all().length, 3);
  });
  await t.test("invalid JSON and amounts rejected", async () => {
    assert.equal(
      (await post({ ...trip, id: "invalid", amount: 0 })).status,
      400,
    );
    assert.equal(
      (
        await fetch(base + "/api/trips", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: "{",
        })
      ).status,
      400,
    );
  });
  await t.test("content type, body limit and methods", async () => {
    assert.equal(
      (await fetch(base + "/api/trips", { method: "POST", body: "{}" })).status,
      415,
    );
    assert.equal((await post({ note: "x".repeat(17_000) })).status, 413);
    assert.equal(
      (await fetch(base + "/api/trips", { method: "DELETE" })).status,
      405,
    );
    assert.equal((await fetch(base + "/api/missing")).status, 404);
  });
  await t.test("data survives new store instance", async () => {
    const reopened = new TripStore(file);
    await reopened.init();
    assert.equal(reopened.all().length, 3);
    assert.deepEqual(
      reopened.all().find((t) => t.id === trip.id),
      trip,
    );
  });
});
