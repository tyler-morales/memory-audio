import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Env } from "./lib/types";
import { api } from "./routes/api";

const app = new Hono<{ Bindings: Env }>();

app.use("/api/*", cors());

app.route("/api", api);

app.notFound(async (c) => {
  // SPA fallback via assets binding when available
  if (c.env.ASSETS) {
    return c.env.ASSETS.fetch(c.req.raw);
  }
  return c.json({ error: "Not found" }, 404);
});

export default app;
