export type Trip = {
  id: string;
  start: string;
  end: string;
  amount: number;
  payment: "cash" | "card";
  commission: number;
};
export const TIME_ZONE = "Asia/Almaty";
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
const cents = (value: number) => Math.round(value * 100);
const money = (value: unknown): value is number =>
  typeof value === "number" &&
  Number.isFinite(value) &&
  Math.abs(value) <= 1_000_000_000 &&
  Math.round(value * 100) / 100 === value;
function timestamp(value: unknown): value is string {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(
      value,
    )
  )
    return false;
  const local = value.slice(0, 10),
    parts = value.match(/T(\d{2}):(\d{2}):(\d{2})/)!;
  if (!validDay(local) || +parts[1] > 23 || +parts[2] > 59 || +parts[3] > 59)
    return false;
  return Number.isFinite(Date.parse(value));
}
export function validDay(value: string): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value
  );
}
export function validateTrip(value: unknown): Trip {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new ApiError(400, "Send a trip JSON object.");
  const t = value as Record<string, unknown>;
  if (typeof t.id !== "string" || !/^[A-Za-z0-9_-]{1,100}$/.test(t.id))
    throw new ApiError(
      400,
      "id must be 1–100 letters, digits, underscores or hyphens.",
    );
  if (!timestamp(t.start) || !timestamp(t.end))
    throw new ApiError(
      400,
      "start and end must be valid ISO timestamps with a timezone.",
    );
  if (Date.parse(t.end) <= Date.parse(t.start))
    throw new ApiError(400, "end must be later than start.");
  if (!money(t.amount) || t.amount <= 0)
    throw new ApiError(
      400,
      "amount must be positive, at most 1 billion, with at most 2 decimal places.",
    );
  if (!money(t.commission) || t.commission < 0 || t.commission > t.amount)
    throw new ApiError(
      400,
      "commission must be between zero and amount, with at most 2 decimal places.",
    );
  if (t.payment !== "cash" && t.payment !== "card")
    throw new ApiError(400, "payment must be cash or card.");
  return {
    id: t.id,
    start: new Date(t.start).toISOString(),
    end: new Date(t.end).toISOString(),
    amount: t.amount,
    payment: t.payment,
    commission: t.commission,
  };
}
export function tripDay(trip: Trip): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(trip.start));
}
export function sameTrip(a: Trip, b: Trip): boolean {
  return (Object.keys(a) as (keyof Trip)[]).every((key) => a[key] === b[key]);
}
export function summarize(trips: Trip[]) {
  const sum = (items: Trip[], key: "amount" | "commission") =>
    items.reduce((total, t) => total + cents(t[key]), 0);
  const breakdown = (payment: Trip["payment"]) => {
    const group = trips.filter((t) => t.payment === payment);
    return {
      count: group.length,
      revenue: sum(group, "amount") / 100,
      commission: sum(group, "commission") / 100,
      takeHome: (sum(group, "amount") - sum(group, "commission")) / 100,
    };
  };
  const revenue = sum(trips, "amount"),
    commission = sum(trips, "commission");
  return {
    count: trips.length,
    revenue: revenue / 100,
    commission: commission / 100,
    takeHome: (revenue - commission) / 100,
    cash: breakdown("cash"),
    card: breakdown("card"),
  };
}
export const seedTrips = [
  {
    id: "t1",
    start: "2026-10-01T08:10:00+05:00",
    end: "2026-10-01T08:32:00+05:00",
    amount: 2400,
    payment: "card",
    commission: 360,
  },
  {
    id: "t2",
    start: "2026-10-01T09:05:00+05:00",
    end: "2026-10-01T09:20:00+05:00",
    amount: 1500,
    payment: "cash",
    commission: 225,
  },
].map(validateTrip);
