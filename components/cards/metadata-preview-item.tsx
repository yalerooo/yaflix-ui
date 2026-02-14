import { forwardRef } from "react";
import { getCoverImage, useHubItem } from "@/hooks/use-hub-item";

const MetadataPreviewItem = forwardRef<
  HTMLDivElement,
  { item: Plex.Metadata | Plex.HubMetadata }
>(({ item }, ref) => {
  const { isSeason, isShow, isMovie, isEpisode, quality, open } =
    useHubItem(item);

  return (
    <div
      ref={ref}
      className="w-full h-full flex flex-col hover:outline rounded overflow-hidden bg-alternative"
    >
      <button type="button" onClick={() => open()}>
        <img className="aspect-video" src={getCoverImage(item.art)} />
        <div className="flex flex-col flex-1 gap-2 text-left p-4">
          {isEpisode && (
            <p className="font-bold text-muted-foreground line-clamp-3 text-sm">
              {(isSeason || isEpisode || isShow) && (
                <span className="uppercase">
                  {isSeason && `s${item.index}`}
                  {isEpisode && `s${item.parentIndex} e${item.index}`}
                  {isShow && `seasons ${item.childCount}`} -&nbsp;
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
                  <p className="border border-muted-foreground rounded-sm px-1 text-sm">
                    {item.contentRating}
                  </p>
                )}
                {quality && (
                  <p className="border border-plex text-plex rounded-sm px-1 text-sm">
                    {quality}
                  </p>
                )}
                {item?.editionTitle && (
                  <p className="border border-plex rounded-sm px-1 text-plex text-sm">
                    {item.editionTitle}
                  </p>
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
