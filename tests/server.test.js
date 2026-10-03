import test from "node:test";
import assert from "node:assert/strict";
import { openDatabase } from "../server/database.js";
import { createApp } from "../server/app.js";
import { scenes } from "../server/scenes.js";

async function fixture(t) {
  let clock = 1000000;
  const db = openDatabase(":memory:");
  const server = createApp(db, { now: () => clock });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  let cookie;
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    db.close();
  });
  async function request(path, data, customCookie = cookie, headers = {}) {
    const res = await fetch(`${base}/api${path}`, {
      method: data === undefined ? "GET" : "POST",
      headers: {
        ...(data === undefined ? {} : { "Content-Type": "application/json" }),
        ...(customCookie ? { Cookie: customCookie } : {}),
        ...headers,
      },
      body: data === undefined ? undefined : JSON.stringify(data),
    });
    cookie ??= res.headers.get("set-cookie")?.split(";")[0];
    return { status: res.status, body: await res.json(), headers: res.headers };
  }
  return {
    db,
    request,
    advance: (ms) => {
      clock += ms;
    },
    cookie: () => cookie,
    base,
  };
}
const point = (scene, id) => {
  const t = scene.targets.find((t) => t.id === id);
  return { characterId: id, x: t.x / scene.width, y: t.y / scene.height };
};

test("scene metadata never reveals target coordinates", async (t) => {
  const f = await fixture(t);
  const response = await f.request("/scenes");
  assert.equal(response.status, 200);
  assert.equal(response.body.length, 3);
  assert.ok(
    response.body.every(
      (s) =>
        !s.targets &&
        s.characters.length === 3 &&
        s.characters.every((c) => !("x" in c)),
    ),
  );
  assert.match(response.headers.get("set-cookie"), /HttpOnly; SameSite=Lax/);
});
test("full round: misses, finds, fixed server time, one score, leaderboard", async (t) => {
  const f = await fixture(t);
  const start = await f.request("/rounds", { sceneId: "park", startedAt: 0 });
  assert.equal(start.status, 201);
  const id = start.body.id;
  assert.equal(
    (await f.request(`/rounds/${id}/score`, { name: "Early", durationMs: 1 }))
      .status,
    409,
  );
  f.advance(1000);
  const miss = await f.request(`/rounds/${id}/attempts`, {
    characterId: "waldo",
    x: 0,
    y: 0,
  });
  assert.equal(miss.body.correct, false);
  assert.equal(miss.body.round.found.length, 0);
  for (const character of ["waldo", "wenda", "wizard"]) {
    f.advance(1500);
    const find = await f.request(
      `/rounds/${id}/attempts`,
      point(scenes[0], character),
    );
    assert.equal(find.body.correct, true);
  }
  const complete = await f.request(`/rounds/${id}`);
  assert.equal(complete.body.complete, true);
  assert.equal(complete.body.elapsedMs, 5500);
  f.advance(30000);
  const score = await f.request(`/rounds/${id}/score`, {
    name: "  Sharp   Eyes  ",
    durationMs: 1,
  });
  assert.equal(score.status, 201);
  assert.equal(score.body.durationMs, 5500);
  assert.equal(score.body.name, "Sharp Eyes");
  assert.equal(
    (await f.request(`/rounds/${id}/score`, { name: "Duplicate" })).status,
    409,
  );
  assert.equal((await f.request("/leaderboard?scene=park")).body.length, 1);
  assert.equal((await f.request("/leaderboard?scene=market")).body.length, 0);
});
test("ownership, malformed points, wrong origin, duplicate finds, and throttling", async (t) => {
  const f = await fixture(t);
  const { body: round } = await f.request("/rounds", { sceneId: "park" });
  assert.equal(
    (
      await f.request(
        `/rounds/${round.id}`,
        undefined,
        "waldo_session=" + "a".repeat(64),
      )
    ).status,
    404,
  );
  assert.equal((await f.request("/rounds", { sceneId: "nope" })).status, 400);
  assert.equal(
    (
      await f.request("/rounds", { sceneId: "park" }, f.cookie(), {
        Origin: "https://evil.example",
      })
    ).status,
    403,
  );
  for (const coords of [
    { x: -1, y: 0.5 },
    { x: 1.2, y: 0.5 },
    { x: "0.5", y: 0.5 },
    { x: null, y: 0.5 },
  ]) {
    assert.equal(
      (
        await f.request(`/rounds/${round.id}/attempts`, {
          characterId: "waldo",
          ...coords,
        })
      ).status,
      400,
    );
  }
  f.advance(1000);
  assert.equal(
    (await f.request(`/rounds/${round.id}/attempts`, point(scenes[0], "waldo")))
      .status,
    200,
  );
  assert.equal(
    (await f.request(`/rounds/${round.id}/attempts`, point(scenes[0], "waldo")))
      .status,
    409,
  );
  assert.equal(
    (await f.request(`/rounds/${round.id}/attempts`, point(scenes[0], "wenda")))
      .status,
    429,
  );
  f.advance(300);
  assert.equal(
    (await f.request(`/rounds/${round.id}/attempts`, point(scenes[0], "wenda")))
      .status,
    200,
  );
});
test("session recovery includes markers and expires after one day", async (t) => {
  const f = await fixture(t);
  const { body: round } = await f.request("/rounds", { sceneId: "coast" });
  f.advance(2500);
  await f.request(`/rounds/${round.id}/attempts`, point(scenes[2], "wizard"));
  const session = await f.request("/session");
  assert.equal(session.body.round.id, round.id);
  assert.equal(session.body.round.found[0].characterId, "wizard");
  assert.equal(session.body.round.elapsedMs, 2500);
  f.advance(86400001);
  assert.equal((await f.request(`/rounds/${round.id}`)).status, 410);
  assert.equal((await f.request("/session")).body.round, null);
});
test("abandoning a round removes it from session recovery and access", async (t) => {
  const f = await fixture(t);
  const { body: round } = await f.request("/rounds", { sceneId: "park" });
  assert.equal(
    (await f.request(`/rounds/${round.id}/abandon`, {})).status,
    200,
  );
  assert.equal((await f.request("/session")).body.round, null);
  assert.equal((await f.request(`/rounds/${round.id}`)).status, 404);
  assert.equal((await f.request("/rounds", null)).status, 400);
  assert.equal((await f.request("/rounds", [])).status, 400);
});
test("all scenes validate normalized coordinates at bounding-box edges", async (t) => {
  const f = await fixture(t);
  for (const scene of scenes) {
    const { body: round } = await f.request("/rounds", { sceneId: scene.id });
    for (const target of scene.targets) {
      f.advance(1000);
      const nearEdge = {
        characterId: target.id,
        x: (target.x + 19) / scene.width,
        y: (target.y - 34) / scene.height,
      };
      assert.equal(
        (await f.request(`/rounds/${round.id}/attempts`, nearEdge)).body
          .correct,
        true,
      );
    }
    assert.equal((await f.request(`/rounds/${round.id}`)).body.complete, true);
  }
});
test("invalid score names are rejected and apostrophes stay literal", async (t) => {
  const f = await fixture(t);
  const { body: round } = await f.request("/rounds", { sceneId: "park" });
  for (const target of scenes[0].targets) {
    f.advance(1000);
    await f.request(
      `/rounds/${round.id}/attempts`,
      point(scenes[0], target.id),
    );
  }
  for (const name of [
    "",
    " ".repeat(10),
    "<script>",
    "a".repeat(25),
    "Bad\nName",
  ]) {
    // Whitespace is normalized, so embedded newlines are accepted as spaces.
    if (name.includes("\n")) continue;
    assert.equal(
      (await f.request(`/rounds/${round.id}/score`, { name })).status,
      400,
    );
  }
  const saved = await f.request(`/rounds/${round.id}/score`, {
    name: "O'Brien",
  });
  assert.equal(saved.status, 201);
  assert.equal((await f.request("/leaderboard")).body[0].name, "O'Brien");
});
