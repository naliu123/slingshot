export type Level = {
  id: string;
  name: string;
  chapter: string;
  tip: string;
  difficulty: number;
  birds: number;
  stars: [number, number];
  palette: { sky: string[]; sun: string; hills: string[]; earth: string };
  shadows: number[][];
  blocks: [number, number, number, number, ("wood" | "stone")?, boolean?][];
  pigs: [number, number, number][];
};

export type GameResult = {
  won: boolean;
  stars: number;
  eyebrow: string;
  title: string;
  description: string;
  breakdown: string;
  nextLabel: string;
};

export type GameSnapshot = {
  page: "levels" | "game";
  gameStarted: boolean;
  levelIndex: number;
  state: "ready" | "aiming" | "flying" | "settling" | "won" | "lost";
  score: number;
  shots: number;
  best: number;
  soundOn: boolean;
  dialog: "settings" | "help" | null;
  result: GameResult | null;
  status: string;
  announcement: string;
  hintVisible: boolean;
  powerVisible: boolean;
  power: number;
  toast: string;
  toastVisible: boolean;
  targets: number;
  progress: Record<string, { best: number; stars: number }>;
};

export type GameController = {
  selectLevel(index: number): void;
  openLevels(): void;
  resumeGame(): void;
  toggleSound(): void;
  setDialog(dialog: GameSnapshot["dialog"]): void;
  reset(): void;
  nextLevel(): void;
  dispose(): void;
};
