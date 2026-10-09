import type { IncomingMessage, ServerResponse } from "node:http";
import {
  ApiError,
  TIME_ZONE,
  summarize,
  tripDay,
  validDay,
  validateTrip,
} from "./domain.ts";
import type { TripStore } from "./store.ts";
export function apiHandler(store: TripStore) {
  return async (
    req: IncomingMessage,
    res: ServerResponse,
  ): Promise<boolean> => {
    const url = new URL(req.url || "/", "http://localhost");
    if (!url.pathname.startsWith("/api/")) return false;
    const json = (status: number, data: unknown) => {
      res.writeHead(status, {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      });
      res.end(JSON.stringify(data));
    };
    try {
      if (url.pathname === "/api/trips" && req.method === "GET") {
        const day = url.searchParams.get("day") || "";
        if (!validDay(day))
          throw new ApiError(400, "day must be a valid YYYY-MM-DD date.");
        const trips = store
          .all()
          .filter((t) => tripDay(t) === day)
          .sort(
            (a, b) =>
              a.start.localeCompare(b.start) || a.id.localeCompare(b.id),
          );
        json(200, {
          day,
          timeZone: TIME_ZONE,
          trips,
          summary: summarize(trips),
        });
      } else if (url.pathname === "/api/trips" && req.method === "POST") {
        if (
          !(req.headers["content-type"] || "")
            .toLowerCase()
            .startsWith("application/json")
        )
          throw new ApiError(415, "Use Content-Type: application/json.");
        let body = "";
        for await (const chunk of req) {
          body += chunk.toString();
          if (Buffer.byteLength(body) > 16_384)
            throw new ApiError(413, "Trip payload is too large.");
        }
        let parsed: unknown;
        try {
          parsed = JSON.parse(body);
        } catch {
          throw new ApiError(400, "Invalid JSON.");
        }
        const result = await store.add(validateTrip(parsed));
        json(result.created ? 201 : 200, result);
      } else if (url.pathname === "/api/trips") {
        res.setHeader("Allow", "GET, POST");
        json(405, { error: "Method not allowed." });
      } else json(404, { error: "API endpoint not found." });
    } catch (error) {
      if (!(error instanceof ApiError)) console.error(error);
      json(error instanceof ApiError ? error.status : 500, {
        error:
          error instanceof ApiError
            ? error.message
            : "The server could not save or load this trip. Please retry.",
      });
    }
    return true;
  };
}
