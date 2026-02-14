import { FC } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getPosterImage } from "@/hooks/use-hub-item";

export const SeasonPreviewItem: FC<{ season: Plex.Metadata }> = ({
  season,
}) => {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <button
      className="relative text-left"
      onClick={() => {
        router.push(`${pathname}?mid=${season.ratingKey}`, { scroll: false });
      }}
    >
      <img
        loading="lazy"
        className="w-full object-cover aspect-[9/14] top-0 rounded"
        src={getPosterImage(season.thumb, false, true)}
        alt="season poster"
      />
      <div className="p-2 w-full font-semibold">
        <p className="truncate">{season.title}</p>
        <p className="text-muted-foreground truncate">
          {season.leafCount} Episodes
        </p>
      </div>
    </button>
  );
};
