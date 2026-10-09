import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import {
  ApiError,
  sameTrip,
  seedTrips,
  validateTrip,
  type Trip,
} from "./domain.ts";
export class TripStore {
  private trips: Trip[] = [];
  private queue: Promise<unknown> = Promise.resolve();
  constructor(private file: string) {}
  async init() {
    try {
      const data: unknown = JSON.parse(await readFile(this.file, "utf8"));
      if (!Array.isArray(data)) throw new Error("Trip data must be an array.");
      this.trips = data.map(validateTrip);
      if (new Set(this.trips.map((t) => t.id)).size !== this.trips.length)
        throw new Error("Duplicate stored trip IDs.");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      this.trips = [...seedTrips];
      await this.persist(this.trips);
    }
  }
  all(): Trip[] {
    return this.trips.map((t) => ({ ...t }));
  }
  private async persist(trips: Trip[]) {
    await mkdir(dirname(this.file), { recursive: true });
    await writeFile(`${this.file}.tmp`, JSON.stringify(trips, null, 2));
    await rename(`${this.file}.tmp`, this.file);
  }
  add(trip: Trip): Promise<{ trip: Trip; created: boolean }> {
    const operation = this.queue.then(async () => {
      const existing = this.trips.find((t) => t.id === trip.id);
      if (existing) {
        if (!sameTrip(existing, trip))
          throw new ApiError(
            409,
            "This trip ID already exists with different details.",
          );
        return { trip: existing, created: false };
      }
      const next = [...this.trips, trip];
      await this.persist(next);
      this.trips = next;
      return { trip, created: true };
    });
    this.queue = operation.catch(() => undefined);
    return operation;
  }
}
