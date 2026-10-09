import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { apiHandler } from "./app.ts";
import { TripStore } from "./store.ts";
const store = new TripStore(
  resolve(process.env.DATA_FILE || "data/trips.json"),
);
await store.init();
const api = apiHandler(store);
const development = process.env.NODE_ENV !== "production";
const vite = development
  ? await (
      await import("vite")
    ).createServer({ server: { middlewareMode: true }, appType: "spa" })
  : null;
const dist = resolve("dist");
const types: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".png": "image/png",
};
const server = createServer(async (req, res) => {
  if (await api(req, res)) return;
  if (vite) {
    vite.middlewares(req, res);
    return;
  }
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405);
    res.end();
    return;
  }
  try {
    let path = resolve(
      dist,
      "." +
        decodeURIComponent(
          new URL(req.url || "/", "http://localhost").pathname,
        ),
    );
    if (path !== dist && !path.startsWith(dist + sep)) {
      res.writeHead(403);
      res.end();
      return;
    }
    if (!extname(path)) path = resolve(dist, "index.html");
    const content = await readFile(path);
    res.writeHead(200, {
      "Content-Type": types[extname(path)] || "application/octet-stream",
    });
    res.end(req.method === "HEAD" ? undefined : content);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
});
server.listen(
  Number(process.env.PORT || 3000),
  process.env.HOST || "127.0.0.1",
  () =>
    console.log(
      `Shiftbook: http://${process.env.HOST || "127.0.0.1"}:${process.env.PORT || 3000}`,
    ),
);
