/* Hand-built layouts. Coordinates use the same 1440 × 630 world as the game.
   Blocks: [x, y, width, height, material?, flag?]. Pigs: [x, y, radius]. */
const SLINGSHOT_LEVELS = [
  {
    id: "greenwood",
    name: "Greenwood Grove",
    chapter: "THE FIRST FLING",
    tip: "Start with the lower wooden supports.",
    difficulty: 1,
    birds: 4,
    stars: [4000, 5000],
    shadows: [[1100, 128]],
    palette: { sky: ["#e0ecdf", "#edf0d8", "#e9eccb"], sun: "#f2e6ad", hills: ["#d0ddbd", "#c2d2ab"], earth: "#dce0b4" },
    blocks: [
      [1028, 505, 38, 28, "stone"], [1172, 505, 38, 28, "stone"],
      [1028, 453, 24, 76], [1172, 453, 24, 76], [1100, 405, 198, 20],
      [1045, 354, 23, 82], [1155, 354, 23, 82], [1100, 303, 162, 20],
      [1062, 265, 20, 56], [1138, 265, 20, 56], [1100, 227, 112, 20],
      [1100, 199, 40, 36, "stone", true]
    ],
    pigs: [[1100, 497, 22], [1100, 374, 21], [1100, 273, 20]]
  },
  {
    id: "twins",
    name: "Twin Timber",
    chapter: "DOUBLE THE TROUBLE",
    tip: "Two towers. Try a low shot, then a high lob.",
    difficulty: 2,
    birds: 6,
    stars: [5000, 6500],
    shadows: [[940, 94], [1190, 94]],
    palette: { sky: ["#deebec", "#e9f0df", "#e9eccb"], sun: "#f6e6b1", hills: ["#cbdcd0", "#bdd0b8"], earth: "#dce0ba" },
    blocks: [
      [884, 471, 24, 96], [996, 471, 24, 96], [940, 413, 156, 20],
      [900, 371, 20, 64], [980, 371, 20, 64], [940, 329, 120, 20],
      [940, 301, 38, 36, "stone", true],
      [1134, 471, 24, 96], [1246, 471, 24, 96], [1190, 413, 156, 20],
      [1150, 371, 20, 64], [1230, 371, 20, 64], [1190, 329, 120, 20],
      [1190, 301, 38, 36, "stone", true]
    ],
    pigs: [[940, 497, 22], [940, 382, 21], [1190, 497, 22], [1190, 382, 21]]
  },
  {
    id: "bridge",
    name: "Willow Bridge",
    chapter: "MIND THE GAP",
    tip: "Break a bridge support and let gravity help.",
    difficulty: 2,
    birds: 6,
    stars: [5000, 6500],
    shadows: [[1075, 214]],
    palette: { sky: ["#e6e9df", "#f4ecd7", "#eeebca"], sun: "#efcf97", hills: ["#d7d9b9", "#c8cda6"], earth: "#e3dab2" },
    blocks: [
      [895, 505, 38, 28, "stone"], [1075, 505, 38, 28, "stone"], [1255, 505, 38, 28, "stone"],
      [895, 451, 24, 80], [1075, 451, 24, 80], [1255, 451, 24, 80],
      [1075, 401, 400, 20],
      [1005, 350, 24, 82], [1145, 350, 24, 82], [1075, 299, 182, 20],
      [1075, 270, 40, 38, "stone", true]
    ],
    pigs: [[979, 497, 22], [1171, 497, 22], [1075, 370, 21], [1205, 371, 20]]
  },
  {
    id: "skyline",
    name: "Skyline Stack",
    chapter: "AIM A LITTLE HIGHER",
    tip: "The tall stack is fragile. Tip it into its neighbors.",
    difficulty: 3,
    birds: 6,
    stars: [5000, 6500],
    shadows: [[950, 55], [1100, 100], [1260, 55]],
    palette: { sky: ["#e3e5ee", "#edf0e1", "#e5e8ca"], sun: "#f2dfb0", hills: ["#cdd7cf", "#becbb9"], earth: "#d8deb7" },
    blocks: [
      [1038, 474, 22, 90], [1162, 474, 22, 90], [1100, 419, 168, 20],
      [1048, 369, 22, 80], [1152, 369, 22, 80], [1100, 319, 144, 20],
      [1058, 269, 20, 80], [1142, 269, 20, 80], [1100, 219, 122, 20],
      [1100, 192, 38, 34, "stone", true],
      [914, 485, 18, 68], [986, 485, 18, 68], [950, 441, 106, 20],
      [1224, 485, 18, 68], [1296, 485, 18, 68], [1260, 441, 106, 20]
    ],
    pigs: [[950, 497, 22], [1100, 497, 22], [1100, 388, 21], [1260, 497, 22]]
  },
  {
    id: "keep",
    name: "Stonewall Keep",
    chapter: "THE GRAND FINALE",
    tip: "Wooden joints are the weak spots in this stone keep.",
    difficulty: 3,
    birds: 7,
    stars: [6500, 8000],
    shadows: [[1090, 210]],
    palette: { sky: ["#ebe1dd", "#f4e9d6", "#ede5c7"], sun: "#efc491", hills: ["#d9d1b9", "#c8c7a6"], earth: "#e3d6b0" },
    blocks: [
      [920, 501, 42, 36, "stone"], [1090, 501, 42, 36, "stone"], [1260, 501, 42, 36, "stone"],
      [920, 442, 26, 82], [1090, 442, 26, 82], [1260, 442, 26, 82],
      [1005, 391, 188, 20], [1184, 391, 170, 20],
      [962, 338, 26, 86], [1218, 338, 26, 86],
      [1090, 285, 296, 20],
      [1020, 246, 24, 58], [1160, 246, 24, 58], [1090, 207, 184, 20],
      [1090, 180, 44, 34, "stone", true],
      [947, 268, 30, 14, "stone"], [1233, 268, 30, 14, "stone"]
    ],
    pigs: [[1005, 497, 22], [1175, 497, 22], [1010, 359, 22], [1170, 359, 22], [1090, 254, 21]]
  }
];
