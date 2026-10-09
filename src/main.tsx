import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import type { Trip } from "../server/domain";
import "./style.css";
type Breakdown = {
  count: number;
  revenue: number;
  commission: number;
  takeHome: number;
};
type Day = {
  day: string;
  timeZone: string;
  trips: Trip[];
  summary: Breakdown & { cash: Breakdown; card: Breakdown };
};
const currency = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "KZT",
    maximumFractionDigits: 2,
  })
    .format(value)
    .replace("KZT", "₸");
const clock = (value: string) =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Almaty",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
const shiftDay = (day: string, offset: number) => {
  const d = new Date(day + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
};
function App() {
  const [day, setDay] = useState("2026-10-01"),
    [data, setData] = useState<Day | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [version, setVersion] = useState(0),
    [showForm, setShowForm] = useState(false),
    [saved, setSaved] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setData(null);
    fetch(`/api/trips?day=${day}`, { signal: controller.signal })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error);
        return result as Day;
      })
      .then(setData)
      .catch((e) => {
        if (e.name !== "AbortError")
          setError(e.message || "Could not load your shift.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [day, version]);
  useEffect(() => {
    setSaved("");
  }, [day]);
  const summary = data?.summary;
  return (
    <div className="app">
      <aside>
        <a className="brand" href="/" aria-label="Shiftbook home">
          <span className="brand-mark">s</span> shiftbook
          <span className="brand-dot">.</span>
        </a>
        <div className="sidebar-section">YOUR WORKSPACE</div>
        <div className="nav-active">
          <span>▦</span> Shift diary <span className="nav-dot" />
        </div>
        <div className="sidebar-note">
          <span className="small-star">✳</span>
          <h3>A clear view of your day</h3>
          <p>
            Every trip, every tenge.
            <br />
            All in one place.
          </p>
        </div>
        <div className="profile">
          <span className="avatar">D</span>
          <div>
            Driver workspace<small>Local demo · no account needed</small>
          </div>
        </div>
      </aside>
      <main>
        <header>
          <span>
            Workspace <span className="crumb">/</span> Shift diary
          </span>
          <span className="status">
            <i /> Local & saved
          </span>
        </header>
        <section className="content">
          <div className="eyebrow">YOUR DAILY PICTURE</div>
          <div className="title-row">
            <div>
              <h1>Make every trip count.</h1>
              <p className="subtitle">
                Your shift, at a glance. Know what you earned and where it came
                from.
              </p>
            </div>
            <button className="primary" onClick={() => setShowForm(true)}>
              ＋ Add trip
            </button>
          </div>
          <div className="day-row">
            <div className="date-controls">
              <button
                aria-label="Previous day"
                onClick={() => setDay(shiftDay(day, -1))}
              >
                ←
              </button>
              <label className="date-label">
                <span className="sr-only">Shift date</span>
                <input
                  aria-label="Shift date"
                  type="date"
                  value={day}
                  onChange={(e) => {
                    if (
                      e.target.value &&
                      /^\d{4}-\d{2}-\d{2}$/.test(e.target.value)
                    )
                      setDay(e.target.value);
                  }}
                />
              </label>
              <button
                aria-label="Next day"
                onClick={() => setDay(shiftDay(day, 1))}
              >
                →
              </button>
            </div>
            <span className="timezone">Asia/Almaty · UTC+5</span>
          </div>
          {saved && (
            <p role="status" className="notice">
              {saved}
            </p>
          )}
          {loading ? (
            <div className="loading" role="status">
              <span className="spinner" /> Loading your shift…
            </div>
          ) : error ? (
            <div className="error-panel" role="alert">
              <h2>Couldn’t load this day</h2>
              <p>{error}</p>
              <button onClick={() => setVersion((v) => v + 1)}>
                Try again
              </button>
            </div>
          ) : (
            summary && (
              <>
                <div className="stats">
                  <div className="stat featured">
                    <span>
                      Take-home earnings <span>↗</span>
                    </span>
                    <strong>{currency(summary.takeHome)}</strong>
                    <p>
                      After commission · {summary.count}{" "}
                      {summary.count === 1 ? "trip" : "trips"}
                    </p>
                    <div className="featured-decoration" />
                  </div>
                  <div className="stat">
                    <span>
                      Total revenue <span>↗</span>
                    </span>
                    <strong>{currency(summary.revenue)}</strong>
                    <p>Before commission</p>
                  </div>
                  <div className="stat">
                    <span>
                      Commission <span>↙</span>
                    </span>
                    <strong>{currency(summary.commission)}</strong>
                    <p>
                      {summary.revenue
                        ? `${((summary.commission / summary.revenue) * 100).toFixed(1)}% of total revenue`
                        : "No commission yet"}
                    </p>
                  </div>
                </div>
                <div className="breakdown">
                  <div className="breakdown-title">
                    <h2>Payment breakdown</h2>
                    <p>Gross fares by payment method</p>
                  </div>
                  {(["card", "cash"] as const).map((method) => (
                    <div className="payment-total" key={method}>
                      <span className={`payment-icon ${method}`}>
                        {method === "card" ? "▰" : "▤"}
                      </span>
                      <div>
                        <span>
                          {method === "card"
                            ? "Card payments"
                            : "Cash payments"}
                        </span>
                        <small>
                          {summary[method].count}{" "}
                          {summary[method].count === 1 ? "trip" : "trips"}
                        </small>
                      </div>
                      <strong>{currency(summary[method].revenue)}</strong>
                    </div>
                  ))}
                </div>
                <div className="trips-heading">
                  <h2>
                    Trip history <span>{summary.count}</span>
                  </h2>
                  <span>Ordered by start time</span>
                </div>
                <div className="table-wrap">
                  {data!.trips.length ? (
                    <table>
                      <thead>
                        <tr>
                          <th>TRIP / TIME</th>
                          <th>DURATION</th>
                          <th>PAYMENT</th>
                          <th>FARE</th>
                          <th>COMMISSION</th>
                          <th>TAKE-HOME</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data!.trips.map((trip, index) => (
                          <tr key={trip.id}>
                            <td>
                              <div className="trip-time">
                                <span className="trip-number">
                                  {String(index + 1).padStart(2, "0")}
                                </span>
                                <div>
                                  <strong>
                                    {clock(trip.start)} <span>→</span>{" "}
                                    {clock(trip.end)}
                                  </strong>
                                  <small>{trip.id}</small>
                                </div>
                              </div>
                            </td>
                            <td>
                              {Math.round(
                                (Date.parse(trip.end) -
                                  Date.parse(trip.start)) /
                                  60000,
                              )}{" "}
                              min
                            </td>
                            <td>
                              <span className={`badge ${trip.payment}`}>
                                {trip.payment === "card" ? "▰ Card" : "▤ Cash"}
                              </span>
                            </td>
                            <td>{currency(trip.amount)}</td>
                            <td className="muted">
                              −{currency(trip.commission)}
                            </td>
                            <td className="take-home">
                              {currency(
                                Math.round(
                                  (trip.amount - trip.commission) * 100,
                                ) / 100,
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="empty">
                      <span>↗</span>
                      <h3>A fresh start</h3>
                      <p>
                        No trips for this day yet. Add your first trip to see
                        your earnings.
                      </p>
                      <button onClick={() => setShowForm(true)}>
                        Add a trip
                      </button>
                    </div>
                  )}
                </div>
                <div className="footnote">
                  <span>
                    ◷ All times shown in Almaty time. Trips belong to the day
                    they start.
                  </span>
                  <span>Keep moving. We’ll keep count.</span>
                </div>
              </>
            )
          )}
        </section>
      </main>
      {showForm && (
        <TripForm
          day={day}
          onClose={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false);
            setVersion((v) => v + 1);
            setSaved("Trip saved.");
          }}
        />
      )}
    </div>
  );
}
function TripForm({
  day,
  onClose,
  onSaved,
}: {
  day: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    id = useRef(crypto.randomUUID());
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    const form = new FormData(e.currentTarget);
    const trip = {
      id: id.current,
      start: `${form.get("start")}:00+05:00`,
      end: `${form.get("end")}:00+05:00`,
      amount: Number(form.get("amount")),
      commission: Number(form.get("commission")),
      payment: form.get("payment"),
    };
    try {
      const response = await fetch("/api/trips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(trip),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      onSaved();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Could not save. Retry to safely send the same trip.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <dialog
      ref={dialog}
      onCancel={(e) => {
        if (busy) e.preventDefault();
        else onClose();
      }}
      aria-labelledby="dialog-title"
    >
      <form onSubmit={submit}>
        <div className="dialog-heading">
          <div>
            <div className="eyebrow">LOG YOUR JOURNEY</div>
            <h2 id="dialog-title">Add a trip</h2>
          </div>
          <button
            type="button"
            aria-label="Close add trip"
            disabled={busy}
            onClick={onClose}
          >
            ×
          </button>
        </div>
        <p className="dialog-subtitle">
          Times are in Almaty (UTC+5). Amounts are in KZT.
        </p>
        <div className="form-grid">
          <label>
            Start time
            <input
              name="start"
              type="datetime-local"
              defaultValue={`${day}T10:00`}
              required
              disabled={busy}
            />
          </label>
          <label>
            End time
            <input
              name="end"
              type="datetime-local"
              defaultValue={`${day}T10:20`}
              required
              disabled={busy}
            />
          </label>
          <label>
            Fare (₸)
            <input
              name="amount"
              type="number"
              min="0.01"
              max="1000000000"
              step="0.01"
              placeholder="2400"
              required
              disabled={busy}
            />
          </label>
          <label>
            Commission (₸)
            <input
              name="commission"
              type="number"
              min="0"
              max="1000000000"
              step="0.01"
              placeholder="360"
              required
              disabled={busy}
            />
          </label>
          <label className="full-width">
            Payment method
            <select name="payment" disabled={busy}>
              <option value="card">Card</option>
              <option value="cash">Cash</option>
            </select>
          </label>
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="dialog-actions">
          <button type="button" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button className="primary" disabled={busy}>
            {busy ? "Saving…" : "Save trip"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
