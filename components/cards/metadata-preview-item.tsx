import { forwardRef } from "react";
import { getCoverImage, useHubItem } from "@/hooks/use-hub-item";
import { useSettings } from "@/components/settings-provider";

const MetadataPreviewItem = forwardRef<
  HTMLDivElement,
  { item: Plex.Metadata | Plex.HubMetadata }
>(({ item }, ref) => {
  const { t } = useSettings();
  const { isSeason, isShow, isMovie, isEpisode, quality, open } =
    useHubItem(item);

  return (
    <div
      ref={ref}
      className="w-full h-full flex flex-col rounded-2xl overflow-hidden bg-white/5 backdrop-blur-md border border-white/10 hover:ring-1 hover:ring-white/20 hover:scale-[1.02] transition-all duration-200"
    >
      <button type="button" onClick={() => open()}>
        <img className="aspect-video w-full object-cover" src={getCoverImage(item.art)} />
        <div className="flex flex-col flex-1 gap-2 text-left p-4">
          {isEpisode && (
            <p className="font-bold text-muted-foreground line-clamp-3 text-sm">
              {(isSeason || isEpisode || isShow) && (
                <span className="uppercase">
                  {isSeason && `s${item.index}`}
                  {isEpisode && `s${item.parentIndex} e${item.index}`}
                  {isShow &&
                    `${t("common.seasons")} ${item.childCount}`}{" "}
                  -&nbsp;
                </span>
              )}
              {item.title}
            </p>
          )}
          <p className="font-bold line-clamp-3">
            {(isShow || isMovie) && item.title}
            {isSeason && item.parentTitle}
            {isEpisode && item.grandparentTitle}
          </p>

          {item.summary && (
            <p className="font-semibold text-muted-foreground text-sm line-clamp-3">
              {item.summary}
            </p>
          )}

          {(item.contentRating || quality) && (
            <>
              <div className="flex-1" />
              <div className="flex items-center font-semibold gap-2 w-full">
                {item.contentRating && (
                  <span className="glass-pill rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white/70">
                    {item.contentRating}
                  </span>
                )}
                {quality && (
                  <span className="glass-pill rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-plex">
                    {quality}
                  </span>
                )}
                {item?.editionTitle && (
                  <span className="glass-pill rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-plex">
                    {item.editionTitle}
                  </span>
                )}
                <div className="flex-1"></div>
                {item.year && <p className="px-1 text-sm">{item.year}</p>}
              </div>
            </>
          )}
        </div>
      </button>
    </div>
  );
});

export { MetadataPreviewItem };
