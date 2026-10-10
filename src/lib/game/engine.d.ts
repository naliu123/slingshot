import type { GameController, GameSnapshot, Level } from "./types";

export function createGame(
  root: HTMLElement,
  options: { onChange(snapshot: GameSnapshot): void; levels?: Level[] },
): GameController;
