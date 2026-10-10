import { ArrowRight, RotateCcw, Settings, Star, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { GameSnapshot, Level } from "@/lib/game/types";
import { cn } from "@/lib/utils";
import { BirdIcon } from "./bird-icon";
import { Brand } from "./brand";

export function Playfield({
  game, level, onReset, onSound, onDialog, onNext, onLevels,
}: {
  game: GameSnapshot;
  level: Level;
  onReset(): void;
  onSound(): void;
  onDialog(dialog: GameSnapshot["dialog"]): void;
  onNext(): void;
  onLevels(): void;
}) {
  const remaining = level.birds - game.shots;
  const result = game.result;
  return (
    <main id="game-page" aria-label="Slingshot game" hidden={game.page !== "game"} className="game-page fixed inset-0 h-dvh w-full">
      <div id="game-stage" data-state={game.state} data-level={game.levelIndex + 1} className="game-stage relative isolate size-full touch-none overflow-hidden bg-[#dfebdf]">
        <canvas
          id="game-canvas" width="1440" height="630" className="block size-full"
          aria-label={`${level.name}. ${level.birds} birds and ${level.pigs.length} green targets. Drag the bird backward and release to launch.`}
        />
        <Brand game />
        <Button id="settings-open" variant="secondary" aria-label="Settings" title="Settings" aria-haspopup="dialog" onClick={() => onDialog("settings")} className="settings-button absolute z-4 h-auto min-h-11 gap-[9px] rounded-xl border border-[#ffffffa6] bg-[#fdfcf7d9] px-4 py-2.5 text-xs font-semibold text-[#586b4e] shadow-[0_3px_12px_#3d4c3108] hover:bg-[#fffdf4] max-[600px]:px-2.5">
          <Settings className="size-5" /><span className="max-[600px]:hidden">Settings</span>
        </Button>
        <div className="score-hud absolute flex flex-col">
          <span className="text-[8px] font-bold tracking-[1.5px] text-[#647865] max-[760px]:text-[6px] max-[760px]:tracking-[1px]">YOUR SCORE</span>
          <strong id="score" className="text-[clamp(25px,3.2vw,43px)] font-bold leading-[1.23] tracking-[1px] tabular-nums max-[760px]:text-[27px]">{String(game.score).padStart(5, "0")}</strong>
          <span className="mt-1 border-t border-[#9bab922e] pt-1.5 text-[7px] tracking-[.8px] text-[#7d8e75] max-[760px]:mt-px max-[760px]:pt-[3px] max-[760px]:text-[5px]">
            PERSONAL BEST <b id="best-score" className="ml-2 text-[9px] font-semibold tabular-nums text-[#687e61] max-[760px]:ml-1 max-[760px]:text-[7px]">{game.best.toLocaleString("en-US")}</b>
          </span>
        </div>
        <div className="level-hud absolute left-1/2 flex -translate-x-1/2 items-center gap-2.5 whitespace-nowrap rounded-full border border-[#9daf932e] bg-[#fcfff231] px-3.5 py-2.5 text-[8px] font-bold tracking-[1px] text-[#687e64] max-[760px]:gap-1.5 max-[760px]:px-[9px] max-[760px]:py-[7px] max-[760px]:text-[6px]">
          <span className="size-[5px] rounded-full bg-[#819668]" />
          <span id="hud-level">LEVEL {String(game.levelIndex + 1).padStart(2, "0")} / 5</span>
          <span className="h-2.5 w-px bg-[#9baf924f] max-[760px]:hidden" />
          <span id="target-count" className="font-normal tracking-[.15px] max-[760px]:hidden">{game.targets} {game.targets === 1 ? "target" : "targets"} left</span>
        </div>
        <div className="birds-hud absolute text-right">
          <span className="text-[8px] font-bold tracking-[1.5px] text-[#7b896e] max-[760px]:text-[6px] max-[760px]:tracking-[1px]">MAKE ’EM COUNT</span>
          <div id="bird-slots" aria-label={`${remaining} ${remaining === 1 ? "bird" : "birds"} remaining`} className="mt-[9px] flex gap-[7px] text-primary max-[760px]:mt-1.5 max-[760px]:gap-1">
            {Array.from({ length: level.birds }, (_, index) => (
              <BirdIcon key={index} className={cn("bird-slot size-7 transition-[opacity,transform] duration-300 max-[760px]:size-[17px]", index < game.shots && "used scale-85 opacity-[.17]")} />
            ))}
          </div>
        </div>
        <Button id="bird-handle" variant="ghost" hidden={!["ready", "aiming"].includes(game.state)} aria-label="Aim bird. Drag backward and release, or use arrow keys to aim and Space to launch." aria-describedby="keyboard-hint" className="bird-handle absolute z-3 size-[60px] touch-none cursor-grab rounded-full bg-transparent p-0 hover:bg-transparent focus-visible:ring-2 focus-visible:ring-[#fdf8d9] active:cursor-grabbing" />
        <div id="aim-hint" hidden={!game.hintVisible} className="aim-hint pointer-events-none absolute flex -rotate-5 items-start gap-1.5 font-serif text-[clamp(11px,1.15vw,16px)] italic text-[#596b47]">
          <span className="mt-[7px] -rotate-16 font-sans text-[31px] font-light max-[760px]:mt-1 max-[760px]:text-xl">↙</span><span>psst… pull me back!</span>
        </div>
        <div id="power-readout" hidden={!game.powerVisible} className="power-readout absolute z-3 flex items-center gap-[7px] rounded-full bg-[#fffaf0e6] px-3 py-2.5 text-[8px] font-bold tracking-[1px] shadow-[0_3px_10px_#435b4310] max-[760px]:gap-[5px] max-[760px]:px-[9px] max-[760px]:py-[7px] max-[760px]:text-[6px]">
          <span>POWER</span><div className="h-1 w-[50px] overflow-hidden rounded-lg bg-[#e2e2d1] max-[760px]:h-[3px] max-[760px]:w-[30px]"><i id="power-fill" className="block h-full bg-primary" style={{ width: `${game.power}%` }} /></div><b id="power-value" className="w-7 tabular-nums">{game.power}%</b>
        </div>
        <div id="shot-toast" role="status" className={cn("shot-toast pointer-events-none absolute left-1/2 top-[19%] -translate-x-1/2 -translate-y-2.5 whitespace-nowrap text-[15px] font-bold text-[#546c4a] opacity-0 transition-[opacity,transform] duration-300 max-[760px]:top-[29%] max-[760px]:text-[11px]", game.toastVisible && "show translate-y-0 opacity-100")}>{game.toast}</div>
        <div className="wind-label absolute left-7 flex items-center gap-[7px] text-[9px] text-[#92986e] max-[760px]:left-4 max-[760px]:gap-1 max-[760px]:text-[6px]"><span className="text-[22px] leading-none max-[760px]:text-[17px]">≈</span> Just you, gravity &amp; a little grit.</div>
        <div className="scene-sign absolute right-7 text-[7px] font-bold tracking-[1.8px] text-[#93956b] max-[760px]:right-[15px] max-[760px]:text-[5px] max-[760px]:tracking-[.8px]"><span id="scene-name">{level.name.toUpperCase()}</span><span className="ml-2 text-[15px] max-[760px]:ml-[3px] max-[760px]:text-[10px]">↟</span></div>

        <div id="result-overlay" hidden={!result} className="result-overlay absolute inset-0 z-5 grid place-items-center bg-[#d3e3c465] p-[15px] backdrop-blur-[6px]">
          <Card className="result-card max-h-full w-[350px] max-w-[95%] gap-0 overflow-y-auto rounded-[20px] border-[#fffef8] bg-card py-0 text-center shadow-[0_15px_55px_#46563d29] max-[760px]:w-[285px] max-[760px]:rounded-[14px]">
            <CardContent className="px-7 py-[29px] max-[760px]:px-[18px] max-[760px]:py-3">
              <span id="result-eyebrow" className="text-[8px] font-bold tracking-[2px] text-[#93977f] max-[760px]:text-[6px]">{result?.eyebrow}</span>
              <div id="result-stars" aria-label={`${result?.stars ?? 0} of 3 stars`} className="my-[13px] flex items-center justify-center gap-3 max-[760px]:my-[5px] max-[760px]:gap-1.5">
                {[0, 1, 2].map(index => <Star key={index} aria-hidden="true" className={cn("size-[35px] text-[#d0cdbc] max-[760px]:size-[22px]", index === 1 && "mb-2.5 size-[43px] max-[760px]:mb-1 max-[760px]:size-[27px]", index < (result?.stars ?? 0) && "earned fill-[#e4af4d] text-[#e4af4d]")} />)}
              </div>
              <h2 id="result-title" className="mb-[7px] text-[30px] font-bold tracking-[-1px] max-[760px]:mb-[3px] max-[760px]:text-[23px]">{result?.title}</h2>
              <p id="result-description" className="text-[11px] leading-[1.7] text-[#8b917e] max-[760px]:text-[9px]">{result?.description}</p>
              <div className="mb-0.5 mt-[17px] max-[760px]:mt-2">
                <span className="block text-[8px] tracking-[1.5px] text-[#a1a58f] max-[760px]:text-[6px]">FINAL SCORE</span><strong id="final-score" className="text-[33px] tracking-[1px] max-[760px]:text-[25px]">{game.score.toLocaleString("en-US")}</strong>
              </div>
              <p id="result-breakdown" className="mb-[17px] text-[9px] leading-[1.7] text-[#8b917e] max-[760px]:mb-2 max-[760px]:text-[7px]">{result?.breakdown}</p>
              <div className="flex items-center justify-center gap-[9px] max-[760px]:gap-[7px]">
                <Button id="play-again" variant="secondary" onClick={onReset} className="h-auto rounded-lg border border-input px-4 py-3 text-[11px] max-[760px]:px-3 max-[760px]:py-2 max-[760px]:text-[10px]">{result?.won ? "Replay" : "Try again"}</Button>
                <Button id="next-level" hidden={!result?.won} onClick={onNext} className="h-auto gap-2 rounded-lg px-[15px] py-[13px] text-xs max-[760px]:py-[9px] max-[760px]:text-[10px]"><span id="next-level-label">{result?.nextLabel}</span><ArrowRight /></Button>
              </div>
              <Button id="result-levels" variant="ghost" onClick={onLevels} className="mt-2 text-[11px] text-[#79856d]">Choose a level</Button>
            </CardContent>
          </Card>
        </div>
        <div className="game-toolbar absolute z-4 flex min-h-[66px] items-center justify-between gap-4 rounded-2xl border border-[#ffffffa6] bg-[#fdfcf7ed] px-[25px] py-3 shadow-[0_8px_24px_#3d4c3110] backdrop-blur-xl max-[600px]:min-h-14 max-[600px]:gap-2 max-[600px]:rounded-xl max-[600px]:px-2.5 max-[600px]:py-2">
          <div id="game-status" className="flex items-center gap-[9px] text-[11px] text-[#6c7962] max-[760px]:gap-[7px] max-[760px]:text-[9px] max-[390px]:text-[8px]"><span className="size-1.5 shrink-0 rounded-full bg-[#9baa7b] shadow-[0_0_0_4px_#9baa7b14]" /><span id="status-text">{game.status}</span></div>
          <span id="keyboard-hint" className="ml-auto mr-[35px] flex items-center gap-[5px] text-[9px] text-[#a3a699] max-[1100px]:hidden"><kbd>↔</kbd><kbd>↕</kbd> aim <span className="mx-[5px]">·</span><kbd>space</kbd> launch</span>
          <div className="toolbar-actions flex shrink-0 items-center gap-[17px] max-[760px]:gap-2 max-[600px]:gap-1">
            <Button id="how-to-open" variant="ghost" size="icon" aria-label="How to play" title="How to play" onClick={() => onDialog("help")} className="size-[38px] text-[19px] text-[#8a927f]">?</Button>
            <Button id="sound-toggle" variant="ghost" size="icon" aria-label={game.soundOn ? "Turn sound off" : "Turn sound on"} aria-pressed={game.soundOn} title={`${game.soundOn ? "Turn sound off" : "Turn sound on"} (M)`} onClick={onSound} className="size-[38px] text-[#8a927f]">{game.soundOn ? <Volume2 id="sound-icon" className="size-[18px]" /> : <VolumeX id="sound-icon" className="size-[18px]" />}</Button>
            <span className="h-5 w-px bg-[#e4e6da] max-[600px]:hidden" />
            <Button id="reset-button" variant="ghost" title="Reset level (R)" onClick={onReset} className="min-h-[38px] gap-2 px-1.5 text-[11px] font-semibold max-[600px]:gap-[5px] max-[600px]:px-1 max-[600px]:text-[9px]"><RotateCcw className="size-4 text-[#8d9681]" /> Reset level <kbd className="ml-2 max-[760px]:hidden">R</kbd></Button>
          </div>
        </div>
      </div>
    </main>
  );
}
