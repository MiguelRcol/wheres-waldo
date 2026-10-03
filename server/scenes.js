export const characters = [
  {
    id: "waldo",
    name: "Waldo",
    description: "Red stripes. Blue trousers.",
    portrait: "/art/waldo.svg",
  },
  {
    id: "wenda",
    name: "Wenda",
    description: "Striped shirt. Red skirt.",
    portrait: "/art/wenda.svg",
  },
  {
    id: "wizard",
    name: "Whitebeard",
    description: "Blue robe. A very long beard.",
    portrait: "/art/wizard.svg",
  },
];

export const scenes = [
  {
    id: "park",
    name: "Sunday in the park",
    location: "A little green escape",
    difficulty: "Easy",
    color: "#dfe7c6",
    image: "/art/park.svg",
    width: 1440,
    height: 900,
    targets: [
      { id: "waldo", x: 1008, y: 591 },
      { id: "wenda", x: 421, y: 696 },
      { id: "wizard", x: 1175, y: 319 },
    ],
  },
  {
    id: "market",
    name: "The weekend market",
    location: "Meet you at the square",
    difficulty: "Medium",
    color: "#f2dbb9",
    image: "/art/market.svg",
    width: 1440,
    height: 900,
    targets: [
      { id: "waldo", x: 355, y: 567 },
      { id: "wenda", x: 1130, y: 655 },
      { id: "wizard", x: 875, y: 289 },
    ],
  },
  {
    id: "coast",
    name: "A day at the coast",
    location: "Salt air & sandy toes",
    difficulty: "Medium",
    color: "#cde4e5",
    image: "/art/coast.svg",
    width: 1440,
    height: 900,
    targets: [
      { id: "waldo", x: 1110, y: 706 },
      { id: "wenda", x: 603, y: 388 },
      { id: "wizard", x: 270, y: 660 },
    ],
  },
];

export function publicScene(scene) {
  const { targets, ...safe } = scene;
  return { ...safe, characters };
}
