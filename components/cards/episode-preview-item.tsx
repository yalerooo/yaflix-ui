import { FC } from "react";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { Play } from "lucide-react";
import { getCoverImage, useHubItem } from "@/hooks/use-hub-item";

export const EpisodePreviewItem: FC<{
  selected?: boolean;
  item: Plex.Metadata;
  count: number;
}> = ({ selected = false, item, count }) => {
  const { play, progress, duration } = useHubItem(item);
  return (
    <button
      type="button"
      onClick={() => play()}
      className={cn(
        "flex flex-row items-center p-4 group transition w-full border-b-2 justify-start text-left",
        selected ? "bg-secondary" : "hover:bg-secondary",
      )}
    >
      <p
        className={`mr-4 text-xl font-bold`}
        style={{ minWidth: `${count}ch` }}
      >
        {item.index}
      </p>
      <div className="mr-4 hidden sm:block sm:min-w-[200px] sm:w-[200px] md:min-w-[250px] md:w-[250px] relative">
        <img
          loading="lazy"
          className="rounded aspect-video object-cover w-full"
          src={getCoverImage(item.thumb || item.art)}
          alt="episode preview image"
        />
        {progress !== 0 && (
          <Progress
            className="absolute rounded-t-none rounded-b bottom-0 left-0 h-[2px]"
            value={progress}
          />
        )}
        <div className="absolute inset-0 flex justify-center items-center opacity-0 group-hover:opacity-100 transition">
          <Play fill="currentColor" />
        </div>
      </div>
      <div className="w-full">
        <p className="font-bold flex flex-row justify-between gap-4">
          <span className="line-clamp-1 sm:line-clamp-2 md:line-clamp-3">
            {item.title}
          </span>
          <span>{duration?.total}m</span>
        </p>
        <p className="line-clamp-2">{item.summary}</p>
      </div>
    </button>
  );
};
