"use client";

import { useEffect, useRef, useState } from "react";
import levels from "@/lib/game/levels";
import type { GameController, GameSnapshot } from "@/lib/game/types";
import { LevelSelection } from "./level-selection";
import { Playfield } from "./playfield";
import { GameDialogs } from "./game-dialogs";

const initialState: GameSnapshot = {
  page: "levels", gameStarted: false, levelIndex: 0, state: "ready",
  score: 0, shots: 0, best: 0, soundOn: false, dialog: null, result: null,
  status: "Your move. Make it fly.", announcement: "",
  hintVisible: true, powerVisible: false, power: 0, toast: "", toastVisible: false,
  targets: levels[0].pigs.length,
  progress: Object.fromEntries(levels.map(level => [level.id, { best: 0, stars: 0 }])),
};

export function SlingshotGame() {
  const root = useRef<HTMLDivElement>(null);
  const controller = useRef<GameController | null>(null);
  const [game, setGame] = useState(initialState);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void import("@/lib/game/engine").then(({ createGame }) => {
      if (cancelled || !root.current) return;
      controller.current = createGame(root.current, { onChange: setGame });
      setReady(true);
    }).catch(() => {
      if (!cancelled) setError("The game could not start. Please reload the page.");
    });
    return () => {
      cancelled = true;
      controller.current?.dispose();
      controller.current = null;
    };
  }, []);

  useEffect(() => {
    const previous = document.body.dataset.page;
    document.body.dataset.page = game.page;
    return () => {
      if (previous === undefined) delete document.body.dataset.page;
      else document.body.dataset.page = previous;
    };
  }, [game.page]);

  const setDialog = (dialog: GameSnapshot["dialog"]) => controller.current?.setDialog(dialog);
  const openLevels = () => controller.current?.openLevels();
  const level = levels[game.levelIndex];

  return (
    <div ref={root} data-game-ready={ready}>
      {error && <p role="alert" className="fixed left-1/2 top-4 z-50 -translate-x-1/2 rounded-xl bg-card p-4 text-destructive">{error}</p>}
      <LevelSelection game={game} onSelect={index => controller.current?.selectLevel(index)} onResume={() => controller.current?.resumeGame()} />
      <Playfield game={game} level={level} onReset={() => controller.current?.reset()} onSound={() => controller.current?.toggleSound()} onDialog={setDialog} onNext={() => controller.current?.nextLevel()} onLevels={openLevels} />
      <GameDialogs game={game} level={level} onDialog={setDialog} onLevels={openLevels} />
      <div id="announcer" className="sr-only" aria-live="polite" aria-atomic="true">{game.announcement}</div>
    </div>
  );
}
