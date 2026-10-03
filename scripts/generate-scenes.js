import { mkdirSync, writeFileSync } from "node:fs";
import { scenes } from "../server/scenes.js";

mkdirSync("public/art", { recursive: true });
const ink = "#343d36";
let seed;
function random() {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
}
const pick = (values) => values[Math.floor(random() * values.length)];
const ellipse = (x, y, rx, ry, fill, extra = "") =>
  `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${fill}" ${extra}/>`;
const rect = (x, y, w, h, fill, radius = 0) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${radius}" fill="${fill}"/>`;
const path = (d, fill, stroke = "", width = 2) =>
  `<path d="${d}" fill="${fill}" ${stroke ? `stroke="${stroke}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"` : ""}/>`;

function person(type, shirt = "#d9875e", pants = "#46617b", skin = "#efc5a1") {
  const wizard = type === "wizard";
  const striped = type === "waldo" || type === "wenda";
  return `<g stroke="${ink}" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round">
    ${ellipse(0, 13, 13, 4, "#46584e", 'opacity=".13" stroke="none"')}
    ${wizard ? path("M-9 -22 L-14 5 Q0 13 14 5 L9 -22Z", "#5576a4") : path("M-7 -2 L-8 10 M6 -2 L8 10", "none", type === "wenda" ? "#efd7b8" : pants, 6)}
    ${path("M-9 11 L-3 11 M5 11 L11 11", "none", "#343d36", 4)}
    ${path("M-8 -24 L-14 -5 M8 -24 L14 -5", "none", striped ? "#eee9d6" : shirt, 5)}
    ${ellipse(-14, -3, 2, 3, skin)}${ellipse(14, -3, 2, 3, skin)}
    ${wizard ? "" : rect(-8, -27, 16, 26, striped ? "#f8f1dc" : shirt, 5)}
    ${striped ? [-24, -16, -8].map((y) => rect(-8, y, 16, 4, "#bd5144")).join("") : ""}
    ${type === "wenda" ? path("M-8 -4 L-12 7 Q0 11 12 7 L8 -4Z", "#bf5146") : ""}
    ${ellipse(0, -36, 8, 10, skin)}
    ${type === "wenda" ? path("M-7 -41 Q-12 -36 -10 -25 L-4 -27 M7 -41 Q12 -35 10 -25 L4 -27", "#88472f") : ""}
    ${wizard ? path("M-8 -43 L0 -65 L9 -43Z", "#5576a4") + ellipse(0, -43, 13, 3, "#5576a4") + path("M-8 -32 Q0 -25 8 -32 L5 -12 L0 -7 L-6 -13Z", "#f5efda") + path("M17 -5 L19 -43 Q19 -51 26 -49", "none", "#a57543", 3) : ""}
    ${striped ? path("M-8 -43 Q-8 -53 0 -53 Q8 -53 8 -43Z", "#f8f1dc") + rect(-8, -47, 16, 4, "#bd5144", 1) + ellipse(0, -54, 3, 3, "#bd5144") + path("M-9 -43 L9 -43", "none", "#bd5144", 3) : ""}
    ${!striped && !wizard ? path("M-8 -38 Q-9 -50 2 -47 Q10 -46 8 -36 L4 -42 L-7 -40Z", pick(["#644939", "#bb7b4a", "#444b40"])) : ""}
    ${type === "waldo" ? '<circle cx="-4" cy="-36" r="3" fill="none"/><circle cx="4" cy="-36" r="3" fill="none"/>' : path("M-3 -36 L-2 -36 M3 -36 L4 -36", "none", ink, 1.5)}
    ${path("M-2 -30 Q0 -28 3 -30", "none", ink, 1)}
  </g>`;
}
function tree(x, y, scale = 1) {
  const color = pick(["#78936b", "#839c6f", "#638669", "#96aa79"]);
  return `<g transform="translate(${x} ${y}) scale(${scale})">${ellipse(7, 16, 44, 13, "#5c785c", 'opacity=".15"')}${path("M-5 13 L-3 -47 L5 -47 L7 13Z", "#8d7651")}${ellipse(0, -57, 36, 43, color)}${ellipse(-20, -42, 25, 29, color)}${ellipse(22, -45, 24, 32, color)}${path("M-18 -57 Q-9 -74 3 -74 M8 -40 Q23 -46 26 -60", "none", "#b5c596", 2)}</g>`;
}
function umbrella(x, y, color, scale = 1) {
  return `<g transform="translate(${x} ${y}) scale(${scale})">${ellipse(5, 18, 44, 12, "#6b6c55", 'opacity=".13"')}${path("M0 -30 L0 16", "none", "#8d7651", 3)}${path("M-42 -29 Q-29 -67 0 -66 Q29 -67 42 -29 Q22 -20 0 -29 Q-22 -20 -42 -29Z", color)}${path("M0 -66 Q-19 -49 -16 -26 M0 -66 Q19 -49 16 -26", "none", "#f8f0d9", 3)}</g>`;
}
function bench(x, y) {
  return `<g transform="translate(${x} ${y})">${path("M-26 6 L-26 17 M26 6 L26 17", "none", "#566650", 4)}${rect(-34, -13, 68, 10, "#b48d57", 2)}${rect(-34, 1, 68, 10, "#c19a60", 2)}${path("M-28 -10 L-28 5 M28 -10 L28 5", "none", "#566650", 3)}</g>`;
}
function flowerBed(x, y, w = 120) {
  let svg = ellipse(x, y, w / 2, 17, "#a9b77c");
  for (let i = 0; i < 16; i++) {
    const xx = x + (random() - 0.5) * w * 0.9,
      yy = y + (random() - 0.5) * 20;
    svg +=
      path(`M${xx} ${yy} l0 -8`, "none", "#768658", 1) +
      ellipse(
        xx,
        yy - 9,
        3,
        3,
        pick(["#d88768", "#f0ce79", "#eeead2", "#b86a64"]),
      );
  }
  return svg;
}
function stall(x, y, color) {
  let svg = `<g transform="translate(${x} ${y})">${ellipse(0, 42, 62, 12, "#927850", 'opacity=".12"')}${rect(-47, -45, 94, 78, "#d4a979", 3)}${rect(-40, -40, 80, 66, "#f3dfb3")}${path("M-57 -48 L-41 -84 L41 -84 L57 -48Z", color)}${rect(-57, -49, 114, 13, color, 2)}${rect(-49, 2, 98, 30, "#bd976b")}`;
  for (let i = 0; i < 5; i++)
    svg += path(`M${-45 + i * 21} -82 l-6 34 h12 l5 -34Z`, "#f7edda");
  for (let i = 0; i < 12; i++)
    svg += ellipse(
      -36 + (i % 6) * 14,
      i < 6 ? -3 : -15,
      6,
      6,
      pick(["#dba15b", "#b97d52", "#a3a76b", "#b86454"]),
    );
  return svg + "</g>";
}
function house(x, y, w, color, roof) {
  let svg = `<g transform="translate(${x} ${y})">${rect(0, 0, w, 155, color)}${path(`M-10 0 L${w / 2} -65 L${w + 10} 0Z`, roof)}${rect(w / 2 - 13, 103, 26, 52, "#79795f", 4)}`;
  for (let row = 0; row < 2; row++)
    for (let col = 0; col < 3; col++)
      svg +=
        rect(17 + (col * (w - 40)) / 3, 22 + row * 45, 20, 29, "#7e9890", 2) +
        path(
          `M${27 + (col * (w - 40)) / 3} ${22 + row * 45} v29`,
          "none",
          "#f5e7c8",
          2,
        );
  return svg + "</g>";
}

for (const scene of scenes) {
  seed = { park: 91, market: 153, coast: 325 }[scene.id];
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1440" height="900" viewBox="0 0 1440 900"><defs><pattern id="grain" width="8" height="8" patternUnits="userSpaceOnUse"><circle cx="1" cy="2" r=".6" fill="#756c47" opacity=".09"/></pattern></defs>`;
  if (scene.id === "park") {
    svg += rect(0, 0, 1440, 900, "#d5deb5");
    svg +=
      path("M-80 240 Q280 135 610 365 T1510 590", "none", "#eae4c9", 106) +
      path("M180 -100 Q315 165 545 510 T825 990", "none", "#eae4c9", 86);
    svg += path(
      "M835 99 Q980 25 1206 92 Q1370 152 1288 249 Q1220 333 1030 303 Q800 283 786 194 Q781 144 835 99Z",
      "#a9c9bf",
      "#8fafa3",
      3,
    );
    svg += path(
      "M860 148 Q1007 78 1202 139 M871 230 Q1047 289 1204 233",
      "none",
      "#c4d8ca",
      3,
    );
    svg += `<g transform="translate(1030 210) rotate(-12)">${ellipse(0, 0, 24, 10, "#b58653")}${ellipse(0, -3, 19, 6, "#e4be83")}${path("M-25 -18 L29 12", "none", "#99764e", 3)}</g>`;
    svg += path(
      "M755 335 L869 268 L894 316 L780 384Z",
      "#bb9970",
      "#a0805c",
      3,
    );
    for (let i = 0; i < 8; i++)
      svg += path(
        `M${765 + i * 14} ${330 - i * 8} l22 44`,
        "none",
        "#d9bc90",
        3,
      );
    svg += house(105, 93, 172, "#ecd4a3", "#b3795c");
    svg +=
      rect(118, 213, 145, 13, "#638778") +
      rect(123, 226, 10, 34, "#69846b") +
      rect(244, 226, 10, 34, "#69846b");
    svg += `<g transform="translate(865 641)">${ellipse(0, 0, 71, 31, "#b5bdb0")}${ellipse(0, -6, 65, 27, "#d6d9c8")}${ellipse(0, -8, 55, 21, "#aac6ba")}${rect(-5, -62, 10, 53, "#e2dcca")}${ellipse(0, -62, 27, 10, "#e9e3cd")}${path("M-20 -61 Q-24 -40 -39 -24 M20 -61 Q24 -40 39 -24", "none", "#d0e4d6", 3)}</g>`;
    for (const [x, y] of [
      [121, 392],
      [304, 533],
      [692, 171],
      [1178, 547],
      [1095, 804],
      [501, 809],
      [91, 743],
      [1314, 751],
      [61, 98],
      [598, 49],
      [1364, 108],
      [719, 754],
      [370, 88],
      [37, 531],
    ])
      svg += tree(x, y, 1.05);
    for (const [x, y] of [
      [405, 362],
      [613, 640],
      [974, 449],
      [219, 642],
      [1217, 431],
    ])
      svg += bench(x, y);
    for (const [x, y] of [
      [586, 261],
      [229, 811],
      [1051, 397],
      [1296, 657],
    ])
      svg += flowerBed(x, y, 115);
    svg += `<g transform="translate(358 600) rotate(8)">${rect(-47, -20, 94, 53, "#e7c6a6", 4)}${path("M-47 -5 H47 M-47 12 H47 M-25 -20 V33 M0 -20 V33 M25 -20 V33", "none", "#f5e7ca", 3)}${ellipse(9, 3, 11, 7, "#f3ecd6")}${rect(-24, -8, 18, 14, "#af7653", 3)}</g>`;
    svg += umbrella(1350, 370, "#d49b72", 0.8);
  } else if (scene.id === "market") {
    svg += rect(0, 0, 1440, 900, "#e7d9ba");
    for (let i = 0; i < 18; i++)
      svg += path(`M0 ${i * 55} H1440`, "none", "#cbbb98", 1);
    for (let i = 0; i < 26; i++)
      svg += path(`M${i * 60} 0 V900`, "none", "#d1c29f", 1);
    for (const [x, w, c, r] of [
      [20, 200, "#dcc49c", "#a66f52"],
      [240, 170, "#e5b693", "#967c66"],
      [430, 220, "#e6d4ad", "#9b795c"],
      [675, 160, "#e2ba97", "#ae765b"],
      [860, 240, "#d4c9a5", "#777e6a"],
      [1120, 250, "#e6c99e", "#b77d59"],
    ])
      svg += house(x, 70, w, c, r);
    svg += path("M0 281 Q720 365 1440 265", "none", "#8c8768", 2);
    for (let i = 0; i < 25; i++)
      svg += path(
        `M${i * 60} ${281 + Math.sin((i / 25) * Math.PI) * 50} l14 26 l14 -25Z`,
        pick(["#c68164", "#a7b08c", "#e5b966"]),
      );
    for (const [x, y, c] of [
      [168, 424, "#9ca77c"],
      [425, 437, "#c68365"],
      [711, 443, "#d5af63"],
      [1017, 448, "#8da59a"],
      [1297, 430, "#b98579"],
      [167, 718, "#c59269"],
      [719, 735, "#98a078"],
      [1016, 778, "#c78265"],
    ])
      svg += stall(x, y, c);
    svg += `<g transform="translate(550 641)">${ellipse(0, 0, 65, 27, "#bfb79d")}${ellipse(0, -7, 60, 25, "#e8dfc3")}${ellipse(0, -9, 49, 18, "#afc7bc")}${rect(-7, -52, 14, 43, "#cdc5a7")}${ellipse(0, -52, 29, 11, "#e8dfc3")}</g>`;
    for (const [x, y] of [
      [40, 311],
      [1396, 660],
      [1235, 843],
      [51, 855],
    ])
      svg += tree(x, y, 1.1);
    svg += bench(350, 823) + bench(1178, 526) + flowerBed(876, 535, 90);
  } else {
    svg += rect(0, 0, 1440, 900, "#eddfb8");
    svg += path(
      "M0 0 H1440 V198 Q1210 282 989 209 Q756 145 570 241 Q324 334 0 258Z",
      "#9fc7c4",
    );
    svg += path(
      "M0 260 Q324 336 570 243 Q756 147 989 211 Q1210 284 1440 200",
      "none",
      "#dbe5d5",
      16,
    );
    for (let i = 0; i < 25; i++) {
      const x = random() * 1440,
        y = random() * 160;
      svg += path(`M${x} ${y} q20 7 40 0`, "none", "#c8dcd0", 2);
    }
    svg += path("M-30 845 Q564 726 1480 850", "none", "#c8b593", 75);
    for (let i = 0; i < 25; i++)
      svg += path(`M${i * 62} 811 l3 40`, "none", "#ac9c7c", 2);
    svg += house(1190, 420, 145, "#e6ce9e", "#a97459");
    for (const [x, y, c, s] of [
      [174, 401, "#c88670", 1],
      [451, 529, "#90a398", 1],
      [771, 360, "#d1ac61", 0.9],
      [1053, 514, "#cb896e", 1],
      [1273, 693, "#93a37b", 1],
      [769, 683, "#bd8d7e", 1],
      [181, 721, "#c6aa68", 0.85],
    ])
      svg += umbrella(x, y, c, s);
    for (const [x, y] of [
      [100, 530],
      [355, 390],
      [671, 602],
      [950, 738],
      [1200, 332],
    ])
      svg += `<g transform="translate(${x} ${y}) rotate(-12)">${rect(-23, -10, 46, 67, pick(["#d7a888", "#a4b7a0", "#deb96a"]), 3)}${path("M-23 0 H23 M-23 46 H23", "none", "#f8eed3", 4)}</g>`;
    svg +=
      path("M835 106 l42 10 l-28 9Z", "#f5e8c8") +
      path("M851 67 v53 M851 70 l-20 37 h20Z", "#f6ecd3", "#8c8e73", 2);
    svg +=
      rect(20, 277, 120, 70, "#cfb185", 4) +
      path("M10 277 L80 226 L150 277Z", "#bd8160");
    svg += bench(459, 815) + bench(1047, 832);
  }
  // Scatter the crowd without covering the three characters.
  const colors = [
    "#cf8b69",
    "#92a68a",
    "#d6b468",
    "#688c99",
    "#bd8b85",
    "#f1e6c9",
    "#858577",
    "#ac9772",
  ];
  const people = [];
  for (let i = 0; i < 112; i++) {
    let x = 45 + random() * 1350,
      y = 300 + random() * 540;
    if (scene.id === "park" && x > 780 && x < 1310 && y < 360) continue;
    if (
      scene.targets.some(
        (t) => Math.abs(x - t.x) < 48 && Math.abs(y - 17 - t.y) < 70,
      )
    )
      continue;
    people.push({
      x,
      y,
      svg: person(
        "crowd",
        pick(colors),
        pick(["#656e65", "#617f88", "#8c775d"]),
        pick(["#efc7a2", "#ca9c79", "#a77858"]),
      ),
    });
  }
  for (const target of scene.targets)
    people.push({ x: target.x, y: target.y + 17, svg: person(target.id) });
  people.sort((a, b) => a.y - b.y);
  for (const p of people)
    svg += `<g transform="translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})">${p.svg}</g>`;
  for (let i = 0; i < 18; i++) {
    const x = 65 + random() * 1290,
      y = 340 + random() * 485;
    if (
      scene.targets.some(
        (t) => Math.abs(x - t.x) < 45 && Math.abs(y - t.y) < 70,
      )
    )
      continue;
    svg += `<g transform="translate(${x} ${y})">${ellipse(0, 0, 10, 4, "#b19468")}${ellipse(8, -4, 4, 5, "#b19468")}${path("M-8 1 l-4 -6 M-6 3 v5 M4 3 v5", "none", "#7e694f", 2)}</g>`;
  }
  svg += rect(0, 0, 1440, 900, "url(#grain)") + "</svg>";
  writeFileSync(`public/art/${scene.id}.svg`, svg);
}
for (const type of ["waldo", "wenda", "wizard"]) {
  seed = 7;
  writeFileSync(
    `public/art/${type}.svg`,
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-30 -70 60 90">${person(type)}</svg>`,
  );
}
writeFileSync(
  "public/art/favicon.svg",
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="18" fill="#bd5144"/><circle cx="29" cy="27" r="14" fill="none" stroke="#fff7e9" stroke-width="5"/><path d="m40 38 12 14" stroke="#fff7e9" stroke-width="5" stroke-linecap="round"/></svg>',
);
console.log("Created three original scenes and character portraits.");
