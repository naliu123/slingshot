import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import type { GameSnapshot, Level } from "@/lib/game/types";

const contentClass = "max-h-[calc(100dvh-28px)] w-[470px] max-w-[calc(100%-28px)] gap-0 overflow-y-auto rounded-[22px] border-[#eeeee1] bg-popover p-[35px] shadow-[0_20px_80px_#2f3f3326] sm:max-w-[470px]";
const titleClass = "mb-[15px] mt-[9px] text-[29px] font-bold leading-normal tracking-[-1px]";
const primaryClass = "h-auto w-full rounded-lg px-[22px] py-[13px] text-xs font-semibold";

export function GameDialogs({
  game, level, onDialog, onLevels,
}: {
  game: GameSnapshot;
  level: Level;
  onDialog(dialog: GameSnapshot["dialog"]): void;
  onLevels(): void;
}) {
  const onCloseAutoFocus = (event: Event) => event.preventDefault();
  return (
    <>
      <Dialog open={game.dialog === "settings"} onOpenChange={open => { if (!open) onDialog(null); }}>
        <DialogContent id="settings-dialog" className={contentClass} showCloseButton={false} onCloseAutoFocus={onCloseAutoFocus}>
          <DialogClose asChild>
            <Button id="settings-close" variant="ghost" size="icon" aria-label="Close settings" className="absolute right-3 top-2 text-[26px] text-[#9aa189]">×</Button>
          </DialogClose>
          <span className="text-[9px] font-bold tracking-[1.5px] text-primary">TAKE A BREATHER</span>
          <DialogTitle id="settings-title" className={titleClass}>Settings</DialogTitle>
          <p id="settings-level-name" className="mb-3 text-xs font-bold leading-[1.8] text-[#596c4d]">LEVEL {String(game.levelIndex + 1).padStart(2, "0")} · {level.name}</p>
          <DialogDescription className="text-xs leading-[1.8]">Game paused. Pick another adventure or return to your current shot.</DialogDescription>
          <div className="mt-6 grid gap-3">
            <Button id="settings-levels" className={primaryClass} onClick={onLevels}>Choose a level <ArrowRight /></Button>
            <Button id="settings-help" variant="secondary" className="h-auto rounded-lg border border-input py-3 text-[11px]" onClick={() => onDialog("help")}>How to play</Button>
            <Button id="settings-resume" variant="ghost" className="text-[11px] text-[#79856d]" onClick={() => onDialog(null)}>Resume game</Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={game.dialog === "help"} onOpenChange={open => { if (!open) onDialog(null); }}>
        <DialogContent id="help-dialog" className={contentClass} showCloseButton={false} onCloseAutoFocus={onCloseAutoFocus}>
          <DialogClose asChild>
            <Button id="how-to-close" variant="ghost" size="icon" aria-label="Close instructions" className="absolute right-3 top-2 text-[26px] text-[#9aa189]">×</Button>
          </DialogClose>
          <span className="text-[9px] font-bold tracking-[1.5px] text-primary">A CRASH COURSE</span>
          <DialogTitle className={titleClass}>Give it your best shot.</DialogTitle>
          <DialogDescription className="text-xs leading-[1.8]">
            You have <strong id="help-birds">{level.birds} birds</strong> to pop all <strong id="help-pigs">{level.pigs.length} green pigs</strong>. A good hit can set off a very satisfying chain reaction.
          </DialogDescription>
          <ol className="my-5 list-decimal space-y-2.5 pl-[18px] text-xs leading-[1.8] text-muted-foreground [&_b]:text-[#4f6047] [&_li]:pl-[5px]">
            <li><b>Grab &amp; pull.</b> Drag the red bird backward. Pull farther for more power; move down for a higher shot.</li>
            <li><b>Pick your path.</b> The short dotted arc previews the start of your flight. Try the wooden supports.</li>
            <li><b>Let go.</b> Falling blocks can knock out pigs. Heavy rubble crushes them, and blocks pressing from opposite sides can squeeze them out. Watch their health bars! Your next bird loads automatically.</li>
          </ol>
          <div className="flex justify-between rounded-[9px] bg-muted px-3 py-[15px] text-[9px] text-[#8b947c] [&_b]:mb-0.5 [&_b]:block [&_b]:text-[15px] [&_b]:text-[#5d7251]">
            <span><b>100</b> wood</span><span><b>200</b> stone</span><span><b>1,000</b> pig</span><span><b>500</b> unused bird</span>
          </div>
          <p className="my-3 text-[10px] leading-[1.8] text-muted-foreground">
            Keyboard: <kbd>↑</kbd><kbd>↓</kbd> angle · <kbd>←</kbd><kbd>→</kbd> power · <kbd>space</kbd> launch · <kbd>R</kbd> reset · <kbd>M</kbd> sound · <kbd>esc</kbd> cancel aim.
          </p>
          <p id="star-guide" className="mb-3 text-[10px] leading-[1.8] text-muted-foreground">
            Pop every pig to win. Earn ★★ at {level.stars[0].toLocaleString("en-US")} points and ★★★ at {level.stars[1].toLocaleString("en-US")} points.
          </p>
          <p className="mb-3 text-[10px] leading-[1.8] text-muted-foreground">Open Settings to choose a level, or clear a level and continue to the next. Each level saves its own best score and stars.</p>
          <Button id="lets-play" className={primaryClass} onClick={() => onDialog(null)}>Let’s make a mess <ArrowRight /></Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
