import { FC, useState } from "react";
import { Progress } from "@/components/ui/progress";
import { HubItemInfo } from "@/hooks/use-hub-item";
import { ClassNameValue } from "tailwind-merge";
import { cn } from "@/lib/utils";
import { useSettings } from "@/components/settings-provider";

export const ElementImagePreviewItem: FC<{
  item: Plex.HubMetadata | Plex.Metadata;
  info: HubItemInfo;
  isOnDeck?: boolean;
  image: string;
  action?: "play" | "open" | null;
  disabled?: boolean;
  indicator?: boolean;
  className?: ClassNameValue;
  progress?: boolean;
  quality?: boolean;
  clearLogo?: string | null;
}> = ({
  item,
  info,
  isOnDeck = false,
  image,
  disabled = false,
  indicator = false,
  className = "",
  action = null,
  progress = true,
  quality = false,
  clearLogo,
}) => {
  const { isEpisode, isMovie, isSeason, play, open } = info;
  const { disableClearLogo } = useSettings();
  const [imgLoaded, setImgLoaded] = useState(false);

  return (
    <button
      className={cn("relative w-full flex flex-col", className)}
      type="button"
      onClick={(e) => {
        e.preventDefault();
        if (action === "play") {
          play();
        } else if (action === "open") {
          open();
        }
      }}
      disabled={disabled}
    >
      <div className="absolute inset-0 bg-white/5 animate-shimmer" style={{ display: imgLoaded ? "none" : undefined }} />
      <img
        className={cn(
          "absolute inset-0 object-cover w-full h-full transition-[transform,opacity] duration-300 group-hover:scale-105",
          imgLoaded ? "opacity-100" : "opacity-0"
        )}
        src={image}
        alt=""
        loading="lazy"
        onLoad={() => setImgLoaded(true)}
      />
      {isOnDeck && clearLogo && !disableClearLogo && (
        <>
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(0, rgba(0, 0, 0, 0.6), rgba(0, 0, 0, 0.15), rgba(0, 0, 0, 0))",
            }}
          ></div>
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(45deg, hsl(var(--background)), rgba(0, 0, 0, 0.03), rgba(0, 0, 0, 0), rgba(0, 0, 0, 0), rgba(0, 0, 0, 0))",
            }}
          ></div>
          <div className="absolute inset-0 bg-center">
            <img
              className="absolute bottom-0 left-0 p-4 w-auto max-w-[calc(70%-2rem)] h-auto max-h-[(100%-2rem)]"
              src={clearLogo}
              alt={item.title}
            />
          </div>
        </>
      )}
      {indicator && (isEpisode || isSeason) && (
        <p className="px-2.5 py-1 glass-pill rounded-bl-xl rounded-tr-xl truncate uppercase text-xs font-bold absolute right-0 top-0">
          {isEpisode && `s${item.parentIndex} e${item.index}`}
          {isSeason && `s${item.index}`}
        </p>
      )}
      {quality && info.quality && (
        <p className="px-2.5 py-1 glass-pill rounded-br-xl rounded-tl-xl truncate uppercase text-xs font-bold absolute left-0 top-0">
          {info.quality}
        </p>
      )}
      <div className="flex-1"></div>
      {progress && (isEpisode || isMovie) && info.progress !== 0 && (
        <Progress
          className="absolute rounded-t-none bottom-0 left-0 h-[2px]"
          value={info.progress}
          color="bg-primary"
        />
      )}
    </button>
  );
};
