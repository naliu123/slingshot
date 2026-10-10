import { ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import levels from "@/lib/game/levels";
import type { GameSnapshot } from "@/lib/game/types";
import { cn } from "@/lib/utils";
import { Brand } from "./brand";

export function LevelSelection({
  game, onSelect, onResume,
}: {
  game: GameSnapshot;
  onSelect(index: number): void;
  onResume(): void;
}) {
  const records = Object.values(game.progress);
  return (
    <main
      id="levels-page"
      aria-labelledby="page-title"
      hidden={game.page !== "levels"}
      className="page-shell mx-auto flex min-h-dvh w-[min(1440px,calc(100%-112px))] flex-col max-[1100px]:w-[calc(100%-64px)] max-[760px]:w-[calc(100%-32px)]"
    >
      <header className="site-header flex min-h-[101px] items-center justify-between gap-7 border-b max-[760px]:min-h-[78px] max-[760px]:gap-2.5">
        <Brand />
        <Button id="resume-game" variant="secondary" hidden={!game.gameStarted} onClick={onResume} className="h-auto rounded-lg border border-input px-4 py-3 text-[11px]">
          Back to game <ArrowUpRight className="size-4" />
        </Button>
      </header>
      <section className="intro pb-8 pt-[clamp(32px,7vh,72px)]">
        <div className="flex items-center gap-2 text-[9px] font-extrabold tracking-[1.8px] text-[#909284] max-[760px]:text-[7px]">
          <span className="h-0.5 w-5 bg-primary" /> FIVE LITTLE ADVENTURES
        </div>
        <h1 id="page-title" tabIndex={-1} className="mb-[7px] mt-[9px] text-[clamp(30px,3.5vw,49px)] font-bold leading-[1.15] tracking-[-2px] outline-none max-[760px]:mt-[11px] max-[760px]:text-[34px] max-[390px]:text-[30px]">
          Pick a level. <span className="font-serif font-normal italic tracking-[-1.6px] text-primary">Let it fly.</span>
        </h1>
        <p className="text-xs tracking-[.1px] text-[#8a8e81] max-[760px]:text-[10px]">Choose your adventure. Every tower has a weak spot.</p>
      </section>
      <section className="level-navigation mb-8" aria-label="Choose a level">
        <div className="mb-[18px] flex items-center justify-between gap-3 px-[3px] text-[#939a83]">
          <span className="text-[8px] font-bold tracking-[1.5px]">YOUR ADVENTURE</span>
          <span id="campaign-progress" className="text-[9px] tabular-nums">
            {records.filter(record => record.stars > 0).length} / {levels.length} cleared · {records.reduce((sum, record) => sum + record.stars, 0)} / {levels.length * 3} stars
          </span>
        </div>
        <div id="level-picker" role="group" aria-label="Levels" className="level-picker grid grid-cols-3 gap-[18px] max-[1000px]:grid-cols-2 max-[600px]:grid-cols-1 max-[600px]:gap-3.5">
          {levels.map((level, index) => {
            const record = game.progress[level.id] ?? { best: 0, stars: 0 };
            return (
              <Card key={level.id} className="gap-0 overflow-hidden rounded-[18px] border-0 bg-transparent py-0 shadow-none">
                <CardContent className="p-0">
                  <Button
                    variant="ghost"
                    data-level-index={index}
                    aria-pressed={index === game.levelIndex}
                    aria-label={`Level ${index + 1}: ${level.name}. ${level.birds} birds, ${level.pigs.length} targets. ${record.stars} of 3 stars.`}
                    onClick={() => onSelect(index)}
                    style={{ background: `linear-gradient(150deg, ${level.palette.sky[0]}, ${level.palette.earth})` }}
                    className={cn(
                      "level-choice relative flex h-auto w-full flex-col items-stretch gap-4 whitespace-normal rounded-[18px] border border-[#d2dbbf] p-6 text-left hover:border-primary hover:shadow-[0_6px_18px_#5a714414] aria-pressed:border-primary max-[600px]:gap-3 max-[600px]:p-5",
                      record.stars > 0 && "cleared",
                    )}
                  >
                    <span className="level-choice-top flex items-center justify-between gap-3">
                      <span className={cn("font-serif text-[38px] font-normal italic leading-none text-[#81936b]", index === game.levelIndex && "text-primary")}>{String(index + 1).padStart(2, "0")}</span>
                      <span className="text-right text-[8px] font-bold tracking-[1px] text-[#73856a]">{level.chapter}</span>
                    </span>
                    <span className="level-choice-copy grid min-w-0 gap-2.5">
                      <strong className="text-xl font-semibold">{level.name}</strong>
                      <span className="text-[11px] text-[#738366]">{level.birds} birds · {level.pigs.length} targets</span>
                      <span className="min-h-[34px] text-[11px] leading-[1.6] text-[#738366] max-[600px]:min-h-0">{level.tip}</span>
                    </span>
                    <span className="flex items-center justify-between border-t border-[#91a57740] pt-3">
                      <span className={cn("level-choice-stars text-[22px] tracking-[3px] text-[#96a583]", record.stars > 0 && "text-[#bb8e32]")} aria-hidden="true">
                        {"★".repeat(record.stars)}{"☆".repeat(3 - record.stars)}
                      </span>
                      <span className="level-choice-best text-right text-[9px] font-normal tabular-nums text-[#748567]">
                        {record.best > 0 ? `BEST ${record.best.toLocaleString("en-US")}` : "READY TO PLAY"}
                      </span>
                    </span>
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
        <p className="mt-6 text-[11px] leading-[1.7] text-[#8a927c]">Every level is ready to play. Best scores and stars are saved as you go.</p>
      </section>
      <footer className="mt-auto flex items-center justify-between gap-4 border-t pb-[25px] pt-[21px] text-[9px] text-[#a3a695] max-[760px]:items-start max-[760px]:text-[8px]">
        <span>Pull back. Let go. Bring the whole thing down.</span>
        <span className="flex items-center gap-[9px] text-[7px] tracking-[1.4px] max-[760px]:gap-[5px] max-[760px]:text-[5px]">MADE FOR THE FUN OF IT <span className="text-xl text-[#a6b293]">✳</span></span>
      </footer>
    </main>
  );
}
