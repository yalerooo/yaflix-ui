import { FC } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getPosterImage } from "@/hooks/use-hub-item";
import { useSettings } from "@/components/settings-provider";

export const SeasonPreviewItem: FC<{ season: Plex.Metadata }> = ({
  season,
}) => {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useSettings();

  return (
    <button
      className="relative text-left group transition-transform duration-200 hover:scale-[1.03]"
      onClick={() => {
        router.push(`${pathname}?mid=${season.ratingKey}`, { scroll: false });
      }}
    >
      <img
        loading="lazy"
        className="w-full object-cover aspect-[9/14] top-0 rounded-xl transition-[filter] duration-200 group-hover:brightness-110"
        src={getPosterImage(season.thumb, false, true)}
        alt={t("common.season")}
      />
      <div className="p-2 w-full font-semibold">
        <p className="truncate">{season.title}</p>
        <p className="text-muted-foreground truncate">
          {season.leafCount}{" "}
          {season.leafCount === 1 ? t("common.episode") : t("common.episodes")}
        </p>
      </div>
    </button>
  );
};
