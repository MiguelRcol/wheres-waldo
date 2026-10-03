const $ = (id) => document.getElementById(id);
const icon = (name) =>
  `<svg class="icon" aria-hidden="true"><use href="#${name}"/></svg>`;
const state = {
  scenes: [],
  scene: null,
  round: null,
  busy: false,
  point: null,
  zoom: 1,
  elapsed: 0,
  syncedAt: 0,
  cursor: { x: 0.5, y: 0.5 },
  leaderboardScene: "park",
  pendingChange: null,
};
let toastTimeout,
  leaderboardRequest = 0;
const time = (ms, precise = false) => {
  const seconds = Math.floor(Math.max(ms, 0) / 1000);
  const base = `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
  return precise
    ? `${base}.${Math.floor((ms % 1000) / 10)
        .toString()
        .padStart(2, "0")}`
    : base;
};
async function api(path, data) {
  const response = await fetch(
    `/api${path}`,
    data === undefined
      ? {}
      : {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        },
  );
  const result = await response.json();
  if (!response.ok)
    throw new Error(result.error || "The request failed. Please try again.");
  return result;
}
function toast(message, type = "") {
  clearTimeout(toastTimeout);
  $("toast").textContent = message;
  $("toast").className = `toast ${type}`;
  $("toast").hidden = false;
  toastTimeout = setTimeout(() => {
    $("toast").hidden = true;
  }, 4000);
}
function closeTarget(returnFocus = false) {
  const wasOpen = !$("target").hidden;
  $("target").hidden = true;
  state.point = null;
  if (returnFocus && wasOpen) $("scene-image").focus({ preventScroll: true });
}
function syncRound(round) {
  state.round = round;
  state.elapsed = round?.elapsedMs ?? 0;
  state.syncedAt = performance.now();
  renderRound();
}
function renderRound() {
  const found = state.round?.found ?? [];
  const playing = state.round && !state.round.complete;
  const started = state.round && state.round.sceneId === state.scene.id;
  $("start-overlay").hidden = Boolean(started);
  $("restart-button").disabled = !started || state.busy;
  $("scene-image").tabIndex = playing ? 0 : -1;
  $("found-count").textContent = `${found.length} / 3`;
  $("progress-bar").style.width = `${(found.length / 3) * 100}%`;
  $("progress-note").textContent =
    found.length === 3
      ? "Every face found. Nicely spotted!"
      : found.length
        ? `${3 - found.length} more ${found.length === 2 ? "face" : "faces"} to find. You’ve got this.`
        : "Three faces. One little adventure.";
  $("scene-instruction").textContent = state.round?.complete
    ? "Everyone found. A lovely little adventure."
    : playing
      ? "Click a familiar face, then choose who you found."
      : "A good adventure starts with a closer look.";
  $("character-list").innerHTML = state.scene.characters
    .map((c) => {
      const isFound = found.some((f) => f.characterId === c.id);
      return `<div class="character-card ${isFound ? "found" : ""}"><div class="character-portrait"><img src="${c.portrait}" alt="${c.name}"/></div><div class="character-info"><h3>${c.name}</h3><p>${isFound ? "Found. Nice spotting!" : c.description}</p></div><span class="character-status" aria-label="${isFound ? "Found" : "Not found yet"}">${icon("check")}</span></div>`;
    })
    .join("");
  $("markers").replaceChildren();
  for (const f of found) {
    const marker = document.createElement("span");
    marker.className = "marker";
    marker.style.left = `${f.x * 100}%`;
    marker.style.top = `${f.y * 100}%`;
    marker.setAttribute(
      "aria-label",
      `${state.scene.characters.find((c) => c.id === f.characterId)?.name} found`,
    );
    $("markers").append(marker);
  }
  $("timer").textContent = time(state.elapsed);
  $("keyboard-cursor").hidden = true;
}
function renderCards() {
  $("scene-cards").innerHTML = state.scenes
    .map(
      (scene, i) =>
        `<button class="scene-card ${scene.id === state.scene.id ? "selected" : ""}" data-scene="${scene.id}" aria-pressed="${scene.id === state.scene.id}"><img src="${scene.image}" alt="Preview of ${scene.name}" loading="lazy"><div><h3>${scene.name}</h3><p>${scene.difficulty}<span></span>3 characters</p></div>${icon(scene.id === state.scene.id ? "check" : "arrow")}</button>`,
    )
    .join("");
}
async function setScene(id) {
  closeTarget();
  state.scene = state.scenes.find((s) => s.id === id);
  const i = state.scenes.indexOf(state.scene);
  document.querySelector(".scene-number").textContent = String(i + 1).padStart(
    2,
    "0",
  );
  $("scene-name").textContent = state.scene.name;
  $("scene-location").textContent = state.scene.location;
  $("difficulty").textContent = state.scene.difficulty;
  $("scene-image").src = state.scene.image;
  $("scene-image").alt =
    `A crowded illustrated scene: ${state.scene.name}. Look for Waldo, Wenda, and Whitebeard.`;
  state.round = null;
  state.elapsed = 0;
  state.zoom = 1;
  state.cursor = { x: 0.5, y: 0.5 };
  renderZoom();
  renderCards();
  renderRound();
  $("start-button").disabled = true;
  try {
    await $("scene-image").decode();
    $("start-button").disabled = false;
  } catch {
    toast("The scene could not load. Please refresh and try again.", "error");
  }
}
async function startRound() {
  if (state.busy) return;
  state.busy = true;
  $("start-button").disabled = true;
  $("start-button").textContent = "Opening your field notes…";
  try {
    await $("scene-image").decode();
    const round = await api("/rounds", { sceneId: state.scene.id });
    syncRound(round);
    toast("The hunt is on. Find Waldo, Wenda, and Whitebeard.");
  } catch (error) {
    toast(error.message, "error");
  } finally {
    state.busy = false;
    $("start-button").disabled = false;
    $("start-button").innerHTML = `Let’s find them ${icon("arrow")}`;
    $("restart-button").disabled = !state.round;
  }
}
function requestChange(id, restart = false) {
  if (state.busy || (!restart && id === state.scene.id)) return;
  if (state.round && !state.round.complete) {
    state.pendingChange = { id, restart };
    $("confirm-dialog").showModal();
  } else changeScene(id, restart);
}
async function changeScene(id, restart) {
  if (state.round && !state.round.complete) {
    try {
      await api(`/rounds/${state.round.id}/abandon`, {});
    } catch (error) {
      toast(error.message, "error");
      return;
    }
  }
  await setScene(id);
  showView("game");
  if (restart) await startRound();
}
function renderZoom() {
  const base = matchMedia("(max-width: 480px)").matches ? 150 : 100;
  $("scene-canvas").style.width = `${base * state.zoom}%`;
  $("zoom-label").textContent = `${Math.round(state.zoom * 100)}%`;
  $("zoom-out").disabled = state.zoom <= 1;
  $("zoom-in").disabled = state.zoom >= 3;
  closeTarget();
}
function zoom(delta) {
  const viewport = $("scene-viewport");
  const old = state.zoom;
  const centerX = viewport.scrollLeft + viewport.clientWidth / 2;
  const centerY = viewport.scrollTop + viewport.clientHeight / 2;
  state.zoom = Math.max(1, Math.min(3, state.zoom + delta));
  renderZoom();
  viewport.scrollLeft = (centerX * state.zoom) / old - viewport.clientWidth / 2;
  viewport.scrollTop = (centerY * state.zoom) / old - viewport.clientHeight / 2;
}
function openTarget(x, y, focus = false) {
  if (state.busy || !state.round || state.round.complete) return;
  state.point = { x, y };
  state.cursor = { x, y };
  const target = $("target");
  target.hidden = false;
  target.style.left = `${x * 100}%`;
  target.style.top = `${y * 100}%`;
  const found = state.round.found;
  $("target-options").innerHTML = state.scene.characters
    .map(
      (c) =>
        `<button class="target-option" data-character="${c.id}" ${found.some((f) => f.characterId === c.id) ? "disabled" : ""}><img src="${c.portrait}" alt="">${c.name}${found.some((f) => f.characterId === c.id) ? icon("check") : ""}</button>`,
    )
    .join("");
  const menu = $("target-menu");
  menu.classList.remove("above", "leftward");
  const view = $("scene-viewport").getBoundingClientRect();
  const box = target.getBoundingClientRect();
  if (box.left + 170 > view.right) menu.classList.add("leftward");
  if (box.top + 175 > view.bottom) menu.classList.add("above");
  if (focus)
    target
      .querySelector("button:not(:disabled)")
      ?.focus({ preventScroll: true });
}
async function attempt(characterId) {
  if (state.busy || !state.point) return;
  const point = { ...state.point };
  state.busy = true;
  closeTarget(true);
  $("restart-button").disabled = true;
  try {
    const response = await api(`/rounds/${state.round.id}/attempts`, {
      characterId,
      ...point,
    });
    syncRound(response.round);
    const character = state.scene.characters.find((c) => c.id === characterId);
    toast(
      response.correct
        ? `${character.name} found! A sharp pair of eyes.`
        : `Not quite ${character.name}. Keep looking!`,
      response.correct ? "success" : "error",
    );
    if (response.round.complete) showFinish();
  } catch (error) {
    toast(error.message, "error");
  } finally {
    state.busy = false;
    $("restart-button").disabled = false;
  }
}
function showFinish() {
  $("finish-scene").textContent = state.scene.name;
  $("finish-time").textContent = time(state.round.elapsedMs, true);
  $("score-form").hidden = state.round.submitted;
  $("score-success").hidden = !state.round.submitted;
  $("score-success-message").textContent = state.round.submitted
    ? "Your time is already in the field notes."
    : "";
  $("score-error").textContent = "";
  $("save-score").disabled = false;
  if (!$("finish-dialog").open) $("finish-dialog").showModal();
}
function showView(view) {
  closeTarget();
  const board = view === "leaderboard";
  $("game-view").hidden = board;
  $("leaderboard-view").hidden = !board;
  $("play-nav").classList.toggle("active", !board);
  $("leaderboard-nav").classList.toggle("active", board);
  if (board) {
    state.leaderboardScene = state.scene.id;
    renderLeaderboard();
  }
}
async function renderLeaderboard() {
  const request = ++leaderboardRequest;
  $("leaderboard-tabs").innerHTML = state.scenes
    .map(
      (s) =>
        `<button data-board-scene="${s.id}" class="${s.id === state.leaderboardScene ? "selected" : ""}" aria-pressed="${s.id === state.leaderboardScene}">${s.name}</button>`,
    )
    .join("");
  const content = $("leaderboard-content");
  content.innerHTML = '<p class="loading-message">Opening the field notes…</p>';
  try {
    const scores = await api(`/leaderboard?scene=${state.leaderboardScene}`);
    if (request !== leaderboardRequest) return;
    if (!scores.length) {
      content.innerHTML = `<div class="empty-scores">${icon("trophy")}<h3>The first page is yours.</h3><p>No times here yet. Finish a hunt and leave your mark.</p></div>`;
      return;
    }
    const table = document.createElement("table");
    table.className = "score-table";
    table.innerHTML =
      '<thead><tr><th scope="col">RANK</th><th scope="col">EXPLORER</th><th scope="col">TIME</th></tr></thead>';
    const tbody = document.createElement("tbody");
    scores.forEach((score, i) => {
      const tr = document.createElement("tr");
      for (const value of [
        String(i + 1).padStart(2, "0"),
        score.name,
        time(score.durationMs, true),
      ]) {
        const cell = document.createElement("td");
        cell.textContent = value;
        tr.append(cell);
      }
      tbody.append(tr);
    });
    table.append(tbody);
    content.replaceChildren(table);
  } catch (error) {
    if (request !== leaderboardRequest) return;
    content.textContent = error.message;
    const retry = document.createElement("button");
    retry.className = "secondary-button";
    retry.textContent = "Try again";
    retry.addEventListener("click", renderLeaderboard);
    content.append(retry);
  }
}

$("start-button").addEventListener("click", startRound);
$("restart-button").addEventListener("click", () =>
  requestChange(state.scene.id, true),
);
$("scene-cards").addEventListener("click", (event) => {
  const card = event.target.closest("[data-scene]");
  if (card) requestChange(card.dataset.scene);
});
$("confirm-change").addEventListener("click", () => {
  $("confirm-dialog").close();
  const change = state.pendingChange;
  state.pendingChange = null;
  if (change) changeScene(change.id, change.restart);
});
$("cancel-change").addEventListener("click", () => {
  $("confirm-dialog").close();
  state.pendingChange = null;
});
$("scene-image").addEventListener("click", (event) => {
  const rect = event.currentTarget.getBoundingClientRect();
  openTarget(
    (event.clientX - rect.left) / rect.width,
    (event.clientY - rect.top) / rect.height,
  );
});
$("target-options").addEventListener("click", (event) => {
  const button = event.target.closest("[data-character]");
  if (button && !button.disabled) attempt(button.dataset.character);
});
document.addEventListener("pointerdown", (event) => {
  if (!event.target.closest("#target") && event.target !== $("scene-image"))
    closeTarget();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeTarget(true);
});
$("scene-image").addEventListener("keydown", (event) => {
  if (!state.round || state.round.complete || state.busy) return;
  if (
    !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Enter", " "].includes(
      event.key,
    )
  )
    return;
  event.preventDefault();
  if (event.key === "Enter" || event.key === " ") {
    openTarget(state.cursor.x, state.cursor.y, true);
    return;
  }
  closeTarget();
  const step = event.shiftKey ? 0.05 : 0.01;
  if (event.key === "ArrowLeft") state.cursor.x -= step;
  if (event.key === "ArrowRight") state.cursor.x += step;
  if (event.key === "ArrowUp") state.cursor.y -= step;
  if (event.key === "ArrowDown") state.cursor.y += step;
  state.cursor.x = Math.max(0.01, Math.min(0.99, state.cursor.x));
  state.cursor.y = Math.max(0.01, Math.min(0.99, state.cursor.y));
  const cursor = $("keyboard-cursor");
  cursor.hidden = false;
  cursor.style.left = `${state.cursor.x * 100}%`;
  cursor.style.top = `${state.cursor.y * 100}%`;
  cursor.scrollIntoView({ block: "nearest", inline: "nearest" });
});
$("scene-image").addEventListener("blur", () => {
  $("keyboard-cursor").hidden = true;
});
$("zoom-in").addEventListener("click", () => zoom(0.5));
$("zoom-out").addEventListener("click", () => zoom(-0.5));
$("zoom-reset").addEventListener("click", () => {
  state.zoom = 1;
  renderZoom();
  $("scene-viewport").scrollTo(0, 0);
});
window.addEventListener("resize", renderZoom);
$("help-button").addEventListener("click", () => $("help-dialog").showModal());
document
  .querySelectorAll("[data-close]")
  .forEach((button) =>
    button.addEventListener("click", () => $(button.dataset.close).close()),
  );
document.querySelectorAll("dialog").forEach((dialog) =>
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) {
      const box = dialog.getBoundingClientRect();
      if (
        event.clientX < box.left ||
        event.clientX > box.right ||
        event.clientY < box.top ||
        event.clientY > box.bottom
      )
        dialog.close();
    }
  }),
);
$("play-nav").addEventListener("click", () => showView("game"));
$("back-to-hunt").addEventListener("click", () => showView("game"));
for (const id of ["leaderboard-nav", "sidebar-leaderboard"])
  $(id).addEventListener("click", () => showView("leaderboard"));
$("leaderboard-tabs").addEventListener("click", (event) => {
  const button = event.target.closest("[data-board-scene]");
  if (button) {
    state.leaderboardScene = button.dataset.boardScene;
    renderLeaderboard();
  }
});
$("finish-leaderboard").addEventListener("click", () => {
  $("finish-dialog").close();
  showView("leaderboard");
});
$("play-again").addEventListener("click", () => {
  $("finish-dialog").close();
  const next = (state.scenes.indexOf(state.scene) + 1) % state.scenes.length;
  changeScene(state.scenes[next].id, false);
});
$("score-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (state.busy) return;
  state.busy = true;
  $("save-score").disabled = true;
  $("score-error").textContent = "";
  try {
    const score = await api(`/rounds/${state.round.id}/score`, {
      name: $("player-name").value,
    });
    state.round.submitted = true;
    $("score-form").hidden = true;
    $("score-success").hidden = false;
    $("score-success-message").textContent =
      `${score.name}, you’re #${score.rank} in this scene’s field notes. A time to be proud of.`;
  } catch (error) {
    $("score-error").textContent = error.message;
  } finally {
    state.busy = false;
    $("save-score").disabled = false;
  }
});
setInterval(() => {
  if (state.round && !state.round.complete)
    $("timer").textContent = time(
      state.elapsed + performance.now() - state.syncedAt,
    );
}, 200);
document.addEventListener("visibilitychange", async () => {
  if (document.hidden || !state.round || state.round.complete || state.busy)
    return;
  try {
    syncRound(await api(`/rounds/${state.round.id}`));
  } catch (error) {
    toast(error.message, "error");
  }
});
async function init() {
  $("start-button").disabled = true;
  try {
    state.scenes = await api("/scenes");
    const { round } = await api("/session");
    await setScene(round?.sceneId ?? "park");
    if (round) {
      syncRound(round);
      if (round.complete && !round.submitted) showFinish();
    }
  } catch (error) {
    $("scene-instruction").textContent =
      "Could not connect. Refresh the page to try again.";
    toast(error.message, "error");
  }
}
init();
