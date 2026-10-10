import { cn } from "@/lib/utils";
import { BirdIcon } from "./bird-icon";

export function Brand({ game = false }: { game?: boolean }) {
  return (
    <a
      href="#levels"
      aria-label={game ? "Choose a level" : "Slingshot level selection"}
      className={cn(
        "brand flex items-center gap-2.5 text-[31px] font-extrabold tracking-[-1.5px] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring max-[760px]:gap-[5px] max-[760px]:text-[26px]",
        game && "game-brand absolute z-4 text-[26px] max-[600px]:text-[23px]",
      )}
    >
      <BirdIcon className={cn("size-[41px] -rotate-10 text-primary max-[760px]:size-[33px]", game && "size-[33px]")} />
      <span>slingshot<span className="text-primary">.</span></span>
    </a>
  );
}
