// Local server: the API, plus the built web app in production.
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { app } from "./app";

const root = new Hono();
root.route("/", app);
// `npm start` passes --production instead of setting NODE_ENV=production inline,
// because that `VAR=value cmd` syntax fails in the Windows shell.
const production = process.argv.includes("--production") || process.env.NODE_ENV === "production";
if (production) {
  root.use("/*", serveStatic({ root: "./dist" }));
  root.get("*", serveStatic({ path: "./dist/index.html" }));
}
const port = Number(process.env.PORT ?? 8787);
serve({ fetch: root.fetch, port }, () => console.log(`UniGenome API on http://localhost:${port}`));
