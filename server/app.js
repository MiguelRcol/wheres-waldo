import { createServer } from "node:http";
import { randomBytes, createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { scenes, publicScene } from "./scenes.js";

const cookieName = "waldo_session";
const day = 24 * 60 * 60 * 1000;
const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};
class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
const fail = (status, message) => {
  throw new ApiError(status, message);
};
const hash = (token) => createHash("sha256").update(token).digest("hex");

async function body(req) {
  let text = "";
  for await (const chunk of req) {
    text += chunk;
    if (Buffer.byteLength(text) > 4096) fail(413, "Request is too large.");
  }
  let result;
  try {
    result = JSON.parse(text);
  } catch {
    fail(400, "Send a valid JSON request.");
  }
  if (!result || typeof result !== "object" || Array.isArray(result))
    fail(400, "Send a JSON object.");
  return result;
}

export function createApp(
  db,
  { publicDir = resolve("public"), production = false, now = Date.now } = {},
) {
  const rates = new Map();
  function rateLimit(owner) {
    const time = now();
    if (rates.size > 10000)
      for (const [key, rate] of rates) if (rate.reset < time) rates.delete(key);
    let rate = rates.get(owner);
    if (!rate || rate.reset < time) {
      rate = { count: 0, reset: time + 60000 };
      rates.set(owner, rate);
    }
    if (++rate.count > 180) fail(429, "Take a moment, then try again.");
  }
  function roundFor(id, owner) {
    const round = db
      .prepare("SELECT * FROM rounds WHERE id = ? AND owner = ?")
      .get(id, owner);
    if (!round) fail(404, "This round could not be found. Start a new hunt.");
    if (now() - round.started_at > day)
      fail(410, "This round has expired. Start a new hunt.");
    return round;
  }
  function roundView(round) {
    return {
      id: round.id,
      sceneId: round.scene_id,
      elapsedMs: (round.finished_at ?? now()) - round.started_at,
      complete: round.finished_at !== null,
      submitted: Boolean(round.submitted),
      found: db
        .prepare(
          "SELECT character_id AS characterId, x, y FROM finds WHERE round_id = ?",
        )
        .all(round.id),
    };
  }
  const server = createServer(async (req, res) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "same-origin");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; img-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
    );
    const json = (status, value) => {
      res.writeHead(status, {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      });
      res.end(JSON.stringify(value));
    };
    try {
      const url = new URL(req.url, "http://localhost");
      if (url.pathname.startsWith("/api/")) {
        if (req.method === "GET" && url.pathname === "/api/health") {
          db.prepare("SELECT 1").get();
          return json(200, { status: "ok" });
        }
        if (req.method === "POST") {
          const origin = req.headers.origin;
          if (origin && new URL(origin).host !== req.headers.host)
            fail(403, "Requests must come from this app.");
          if (!req.headers["content-type"]?.startsWith("application/json"))
            fail(415, "Use application/json.");
        }
        const cookies = req.headers.cookie ?? "";
        let token = cookies
          .split(";")
          .map((v) => v.trim())
          .find((v) => v.startsWith(`${cookieName}=`))
          ?.slice(cookieName.length + 1);
        if (!token || !/^[a-f0-9]{64}$/.test(token)) {
          token = randomBytes(32).toString("hex");
          res.setHeader(
            "Set-Cookie",
            `${cookieName}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400${production ? "; Secure" : ""}`,
          );
        }
        const owner = hash(token);
        rateLimit(owner);
        if (req.method === "GET" && url.pathname === "/api/scenes")
          return json(200, scenes.map(publicScene));
        if (req.method === "GET" && url.pathname === "/api/session") {
          const round = db
            .prepare(
              "SELECT * FROM rounds WHERE owner = ? AND started_at > ? ORDER BY started_at DESC, rowid DESC LIMIT 1",
            )
            .get(owner, now() - day);
          return json(200, { round: round ? roundView(round) : null });
        }
        if (req.method === "GET" && url.pathname === "/api/leaderboard") {
          const sceneId = url.searchParams.get("scene") ?? "park";
          if (!scenes.some((s) => s.id === sceneId))
            fail(404, "Scene not found.");
          const scores = db
            .prepare(
              "SELECT name, duration_ms AS durationMs, created_at AS createdAt FROM scores WHERE scene_id = ? ORDER BY duration_ms, created_at LIMIT 20",
            )
            .all(sceneId);
          return json(200, scores);
        }
        if (req.method === "POST" && url.pathname === "/api/rounds") {
          const input = await body(req);
          if (!scenes.some((s) => s.id === input.sceneId))
            fail(400, "Choose a valid scene.");
          const recent = db
            .prepare(
              "SELECT COUNT(*) AS count FROM rounds WHERE owner = ? AND started_at > ?",
            )
            .get(owner, now() - 60000);
          if (recent.count >= 10)
            fail(429, "Too many new rounds. Try again in a minute.");
          const id = randomBytes(16).toString("hex");
          db.prepare(
            "INSERT INTO rounds (id, owner, scene_id, started_at) VALUES (?, ?, ?, ?)",
          ).run(id, owner, input.sceneId, now());
          return json(201, roundView(roundFor(id, owner)));
        }
        const match = url.pathname.match(
          /^\/api\/rounds\/([a-f0-9]{32})(?:\/(attempts|score|abandon))?$/,
        );
        if (match) {
          const round = roundFor(match[1], owner);
          if (req.method === "GET" && !match[2])
            return json(200, roundView(round));
          if (req.method === "POST" && match[2] === "abandon") {
            await body(req);
            if (round.finished_at !== null)
              fail(409, "Completed rounds cannot be abandoned.");
            db.prepare("DELETE FROM rounds WHERE id = ?").run(round.id);
            return json(200, { abandoned: true });
          }
          if (req.method === "POST" && match[2] === "attempts") {
            if (round.finished_at !== null)
              fail(409, "You already completed this hunt.");
            const input = await body(req);
            if (
              !Number.isFinite(input.x) ||
              !Number.isFinite(input.y) ||
              input.x < 0 ||
              input.x > 1 ||
              input.y < 0 ||
              input.y > 1
            )
              fail(400, "Choose a point inside the scene.");
            const target = db
              .prepare(
                "SELECT * FROM targets WHERE scene_id = ? AND character_id = ?",
              )
              .get(round.scene_id, input.characterId);
            if (!target) fail(400, "Choose a valid character.");
            if (
              db
                .prepare(
                  "SELECT 1 FROM finds WHERE round_id = ? AND character_id = ?",
                )
                .get(round.id, input.characterId)
            )
              fail(409, "You already found this character.");
            if (round.last_attempt_at && now() - round.last_attempt_at < 250)
              fail(429, "Take a moment before your next guess.");
            db.prepare(
              "UPDATE rounds SET last_attempt_at = ? WHERE id = ?",
            ).run(now(), round.id);
            const correct =
              Math.abs(input.x - target.x) <= target.half_width &&
              Math.abs(input.y - target.y) <= target.half_height;
            if (correct) {
              db.prepare("INSERT INTO finds VALUES (?, ?, ?, ?)").run(
                round.id,
                input.characterId,
                target.x,
                target.y,
              );
              const count = db
                .prepare(
                  "SELECT COUNT(*) AS count FROM finds WHERE round_id = ?",
                )
                .get(round.id).count;
              if (count === 3)
                db.prepare(
                  "UPDATE rounds SET finished_at = ? WHERE id = ?",
                ).run(now(), round.id);
            }
            return json(200, {
              correct,
              round: roundView(roundFor(round.id, owner)),
            });
          }
          if (req.method === "POST" && match[2] === "score") {
            if (round.finished_at === null)
              fail(409, "Find everyone before saving your score.");
            if (round.submitted)
              fail(409, "This score has already been saved.");
            const input = await body(req);
            const name =
              typeof input.name === "string"
                ? input.name.trim().replace(/\s+/g, " ")
                : "";
            if (
              name.length < 1 ||
              name.length > 24 ||
              /[\x00-\x1F\x7F<>]/.test(name)
            )
              fail(
                400,
                "Enter a name of 1–24 characters without angle brackets.",
              );
            const duration = round.finished_at - round.started_at;
            db.exec("BEGIN IMMEDIATE");
            try {
              db.prepare(
                "INSERT INTO scores (round_id, scene_id, name, duration_ms, created_at) VALUES (?, ?, ?, ?, ?)",
              ).run(round.id, round.scene_id, name, duration, now());
              db.prepare("UPDATE rounds SET submitted = 1 WHERE id = ?").run(
                round.id,
              );
              db.exec("COMMIT");
            } catch (error) {
              db.exec("ROLLBACK");
              throw error;
            }
            const rank = db
              .prepare(
                "SELECT COUNT(*) + 1 AS rank FROM scores WHERE scene_id = ? AND duration_ms < ?",
              )
              .get(round.scene_id, duration).rank;
            return json(201, { rank, durationMs: duration, name });
          }
        }
        fail(404, "Endpoint not found.");
      }
      if (req.method !== "GET" && req.method !== "HEAD")
        fail(405, "Method not allowed.");
      const pathname = decodeURIComponent(url.pathname);
      const file = resolve(
        publicDir,
        "." + (pathname === "/" ? "/index.html" : pathname),
      );
      if (!file.startsWith(publicDir + sep)) fail(404, "File not found.");
      if (!mimeTypes[extname(file)]) fail(404, "File not found.");
      let contents;
      try {
        contents = await readFile(file);
      } catch {
        fail(404, "File not found.");
      }
      res.writeHead(200, {
        "Content-Type": mimeTypes[extname(file)],
        "Cache-Control":
          extname(file) === ".html" ? "no-cache" : "public, max-age=3600",
      });
      res.end(req.method === "HEAD" ? undefined : contents);
    } catch (error) {
      if (!error.status) console.error(error);
      json(error.status ?? 500, {
        error: error.status
          ? error.message
          : "Something went wrong. Please try again.",
      });
    }
  });
  return server;
}
