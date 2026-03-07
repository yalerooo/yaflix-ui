import {
  FC,
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import qs from "qs";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, Pencil, Play, X } from "lucide-react";
import { Carousel, CarouselItem } from "@/components/carousel";
import { OnDeckImagePreviewItem } from "@/components/cards/on-deck-image-preview-item";
import { OtherImagePreviewItem } from "@/components/cards/other-image-preview-item";
import { HubItemInfo, useHubItem } from "@/hooks/use-hub-item";
import { Progress } from "@/components/ui/progress";
import { durationToMin, uuid } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ServerApi, xprops } from "@/api";
import axios, { Canceler } from "axios";
import { useIsSize } from "@/hooks/use-is-size";
import { useSession } from "@/hooks/use-session";
import { useSettings } from "@/components/settings-provider";

const canEditType = (type: Plex.LibraryType) => {
  return (
    type === "movie" ||
    type === "show" ||
    type === "season" ||
    type === "episode"
  );
};

const isAdminUser = (user: Plex.UserData | null) => {
  if (!user) return false;
  const sessionUser = user as Plex.UserData & {
    homeAdmin?: boolean;
    restricted?: boolean;
  };
  if (typeof sessionUser.homeAdmin === "boolean") return sessionUser.homeAdmin;
  if (typeof sessionUser.restricted === "boolean") return !sessionUser.restricted;
  return !!sessionUser.email;
};

const HubFloatingItem = ({
  info,
  item,
  onUpdate,
  isContinueWatching,
}: {
  info: HubItemInfo;
  item: Plex.HubMetadata;
  onUpdate: (item: Plex.HubMetadata) => void;
  isContinueWatching?: boolean;
}) => {
  const { t } = useSettings();
  const handleUpdate = () => {
    if (info.guid) {
      ServerApi.discoverMetadata({ guid: info.guid });
    }
    onUpdate(item);
  };

  const handleRemoveFromContinueWatching = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const success = await ServerApi.removeFromContinueWatching({
      key: item.ratingKey,
    });
    if (success) {
      handleUpdate();
    }
  };

  return (
    <div className="glass-dark rounded-2xl overflow-hidden glass-glow">
      <OnDeckImagePreviewItem
        item={item}
        info={info}
        progress={false}
        action="play"
        isOnDeck
      />

      <div
        onClick={() => info.open()}
        className="p-3 w-full max-w-full flex-1 text-left text-xs cursor-pointer"
      >
        <div className="mb-2 flex flex-row items-center gap-2">
          <Button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              info.play();
            }}
            variant="default"
            size="icon-sm"
            className="rounded-full z-[51]"
          >
            <Play fill="currentColor" className="scale-75" />
          </Button>
          <div className="flex-1" />
          {isContinueWatching && (
            <Button
              type="button"
              onClick={handleRemoveFromContinueWatching}
              variant="search"
              size="icon-sm"
              className="rounded-full z-[51]"
              title="Quitar de Seguir viendo"
            >
              <X className="scale-75" strokeWidth={3} />
            </Button>
          )}
          <Button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              // TODO: open menu for options
              ServerApi[info.watched ? "unscrobble" : "scrobble"]({
                key: item.ratingKey,
              }).then((success) => {
                if (success) handleUpdate();
              });
            }}
            variant="search"
            size="icon-sm"
            className="rounded-full z-[51]"
          >
            {info.watched ? (
              <svg
                className="lucide lucide-circle-check"
                viewBox="0 0 24 24"
                width="24"
                height="24"
                fill="currentColor"
              >
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2M9.29 16.29 5.7 12.7a.996.996 0 0 1 0-1.41c.39-.39 1.02-.39 1.41 0L10 14.17l6.88-6.88c.39-.39 1.02-.39 1.41 0s.39 1.02 0 1.41l-7.59 7.59c-.38.39-1.02.39-1.41 0"></path>
              </svg>
            ) : (
              <svg
                className="lucide lucide-circle-check"
                viewBox="0 0 24 24"
                width="24"
                height="24"
                fill="currentColor"
              >
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2m0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8m3.88-11.71L10 14.17l-1.88-1.88a.996.996 0 0 0-1.41 0c-.39.39-.39 1.02 0 1.41l2.59 2.59c.39.39 1.02.39 1.41 0L17.3 9.7c.39-.39.39-1.02 0-1.41s-1.03-.39-1.42 0"></path>
              </svg>
            )}
          </Button>
          <Button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              info.open();
            }}
            variant="search"
            size="icon-sm"
            className="rounded-full z-[51]"
          >
            <ChevronDown className="scale-75" strokeWidth={3} />
          </Button>
        </div>
        <div className="flex flex-col gap-1">
          {info.isEpisode && (
            <p className="font-semibold line-clamp-3">
              {(info.isSeason || info.isEpisode || info.isShow) && (
                <span className="uppercase">
                  {info.isSeason && `s${item.index}`}
                  {info.isEpisode && `s${item.parentIndex} e${item.index}`}
                  {info.isShow && `${t("common.seasons")} ${item.childCount}`} -&nbsp;
                </span>
              )}
              {item.title}
            </p>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (info.isEpisode && item.grandparentRatingKey) {
                info.open(item.grandparentRatingKey);
              } else if (info.isSeason && item.parentRatingKey) {
                info.open(item.parentRatingKey);
              }
            }}
            className="font-semibold text-[0.7rem] text-muted-foreground line-clamp-3 text-left hover:text-foreground transition-colors cursor-pointer"
          >
            {(info.isShow || info.isMovie) && item.title}
            {info.isSeason && item.parentTitle}
            {info.isEpisode && item.grandparentTitle}
          </button>
          {(info.isEpisode || info.isMovie) && (
            <div className="flex flex-row gap-2 items-center">
              <Progress
                className="h-[2px] rounded-full"
                value={info.progress ?? 0}
              />
              <span className="font-semibold flex-1 min-w-fit">
                {item.viewOffset
                  ? `${durationToMin(item.viewOffset)} of `
                  : null}
                {durationToMin(item.duration)}m
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const HubItem = forwardRef<
  HTMLDivElement,
  {
    item: Plex.HubMetadata;
    index: number;
    refKey: string;
    isOnDeck: boolean;
    isContinueWatching: boolean;
    onUpdate: (item: Plex.HubMetadata) => void;
  }
>(({ item, index, refKey, isOnDeck, isContinueWatching, onUpdate }, ref) => {
  const info = useHubItem(item, { higherResolution: true });
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useSession();
  const { t } = useSettings();
  const { isEpisode, isSeason, isShow, isMovie } = info;
  const canEdit = isAdminUser(user) && canEditType(item.type);

  const handleRemoveFromContinueWatching = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const success = await ServerApi.removeFromContinueWatching({
      key: item.ratingKey,
    });
    if (success) {
      onUpdate(item);
    }
  };

  return (
    <CarouselItem
      key={refKey}
      refKey={refKey}
      ref={ref}
      index={index}
      hoverview={
        isOnDeck && !isContinueWatching ? (
          <HubFloatingItem item={item} info={info} onUpdate={onUpdate} isContinueWatching={isContinueWatching} />
        ) : undefined
      }
    >
      <div className="relative">
        {canEdit && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              router.push(
                `${pathname}?${qs.stringify({ mid: item.ratingKey, edit: 1 })}`,
                { scroll: false },
              );
            }}
            className="absolute top-2 left-2 z-10 w-7 h-7 rounded-full bg-black/70 hover:bg-black/90 flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 glass-dark"
            title="Editar metadatos"
          >
            <Pencil className="w-3.5 h-3.5 text-white" />
          </button>
        )}
        {isContinueWatching && (
          <div className="absolute top-2 right-2 z-10 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-all">
            <button
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                ServerApi[info.watched ? "unscrobble" : "scrobble"]({
                  key: item.ratingKey,
                }).then((success) => {
                  if (success) onUpdate(item);
                });
              }}
              className="w-7 h-7 rounded-full bg-black/70 hover:bg-black/90 flex items-center justify-center glass-dark"
              title={
                info.watched
                  ? t("metaYaflix.markAsUnwatched")
                  : t("metaYaflix.markAsWatched")
              }
            >
              {info.watched ? (
                <svg
                  className="w-4 h-4 text-white"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2M9.29 16.29 5.7 12.7a.996.996 0 0 1 0-1.41c.39-.39 1.02-.39 1.41 0L10 14.17l6.88-6.88c.39-.39 1.02-.39 1.41 0s.39 1.02 0 1.41l-7.59 7.59c-.38.39-1.02.39-1.41 0" />
                </svg>
              ) : (
                <svg
                  className="w-4 h-4 text-white"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.4"
                >
                  <circle cx="12" cy="12" r="9" />
                  <path d="M8 12.5l2.5 2.5L16 9.5" opacity="0.5" />
                </svg>
              )}
            </button>
            <button
              onClick={handleRemoveFromContinueWatching}
              className="w-7 h-7 rounded-full bg-black/70 hover:bg-black/90 flex items-center justify-center glass-dark"
              title="Quitar de Seguir viendo"
            >
              <X className="w-4 h-4 text-white" strokeWidth={2.5} />
            </button>
          </div>
        )}
        {isOnDeck ? (
          <OnDeckImagePreviewItem
            item={item}
            info={info}
            className="rounded-xl overflow-hidden"
            action={isContinueWatching ? "play" : "open"}
            progress={false}
            isOnDeck
          />
        ) : (
          <OtherImagePreviewItem
            item={item}
            info={info}
            // indicator
            className="rounded-xl overflow-hidden"
            action="open"
            progress={false}
          />
        )}
      </div>
      <div className="py-2 px-2 w-full max-w-full flex-1 text-left space-y-1.5">
        {isContinueWatching && (
          <Progress
            className="rounded-t-none h-[2px]"
            value={info.progress}
          />
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (isEpisode && item.grandparentRatingKey) {
              info.open(item.grandparentRatingKey);
            } else if (isSeason && item.parentRatingKey) {
              info.open(item.parentRatingKey);
            }
          }}
          className="font-semibold text-xs text-muted-foreground line-clamp-1 text-left w-full hover:text-foreground transition-colors cursor-pointer"
        >
          {isSeason && `S${item.index} - `}
          {isEpisode && `S${item.parentIndex} E${item.index} - `}
          {(isShow || isMovie) && item.title}
          {isSeason && item.parentTitle}
          {isEpisode && item.grandparentTitle}
        </button>
      </div>
    </CarouselItem>
  );
});

export const isOnDeckHub = (hub: Plex.Hub) => {
  const isInProgress = hub.context.includes("inprogress");
  const isContinueWatching = hub.context.includes("continueWatching");
  const isEpisodeType = hub.type === "episode";
  const isClipType = hub.type === "clip";
  return isInProgress || isContinueWatching || isEpisodeType || isClipType;
};

// TODO: have the HubSlider only receive the hub key and then let him deal with the items and fetching
export const HubSlider: FC<{
  hub: Plex.Hub;
  onUpdate: (item: Plex.HubMetadata, index: number) => void;
  onAppend: (items: Plex.HubMetadata[]) => void;
  id?: string | undefined;
}> = ({ id = undefined, hub, onUpdate, onAppend }) => {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useSettings();
  const token = localStorage.getItem("token");
  const server = localStorage.getItem("server");
  const { isTiny } = useIsSize();

  const isOnDeck = useMemo(() => isOnDeckHub(hub), [hub]);

  const isContinueWatching = useMemo(
    () => hub.key.includes("continueWatching"),
    [hub],
  );

  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [page, setPage] = useState(0);
  const observer = useRef<IntersectionObserver>();
  const lastRef = useCallback(
    (node: HTMLDivElement) => {
      if (loading || !hasMore) return;
      if (observer.current) observer.current.disconnect();
      observer.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) {
          setPage((p) => p + 1);
        }
      });
      if (node) observer.current.observe(node);
    },
    [loading, hasMore],
  );

  const [prevHubLength, setPrevHubLength] = useState<number | undefined>(
    undefined,
  );

  const localizeHubTitle = (title: string) => {
    const replacements: Array<[RegExp, string]> = [
      [/\bContinue Watching\b/i, t("hubs.continueWatching")],
      [/\bRecently Added\b/i, t("hubs.recentlyAdded")],
      [/\bRecently Released\b/i, t("hubs.recentlyReleased")],
      [/\bOn Deck\b/i, t("hubs.onDeck")],
      [/\bTop Rated\b/i, t("hubs.topRated")],
      [/\bTrending\b/i, t("hubs.trending")],
      [/\bPopular\b/i, t("hubs.popular")],
      [/\bRecommended\b/i, t("hubs.recommended")],
    ];

    return replacements.reduce(
      (acc, [pattern, replacement]) => acc.replace(pattern, replacement),
      title,
    );
  };

  useEffect(() => {
    if (!hasMore || prevHubLength === hub.Metadata?.length || page === 0) {
      return;
    }
    setLoading(true);
    setPrevHubLength(hub.Metadata?.length);
    let cancel: Canceler;
    const decodedKey = decodeURIComponent(hub.key);
    axios
      .get<{
        MediaContainer: { Metadata: Plex.HubMetadata[]; totalSize: number };
      }>(
        `${server}${decodedKey}${decodedKey.includes("?") ? "&" : "?"}${qs.stringify(
          {
            ...xprops(),
            excludeFields: "summary",
            "X-Plex-Container-Start": hub.Metadata?.length ?? 0,
            "X-Plex-Container-Size": 30,
            uuid: uuid(),
          },
        )}`,
        {
          headers: { "X-Plex-Token": token, accept: "application/json" },
          cancelToken: new axios.CancelToken((c) => {
            cancel = c;
          }),
        },
      )
      .then((res) => {
        if (res.data?.MediaContainer?.Metadata) {
          if (
            res.data.MediaContainer.Metadata.length +
              (hub.Metadata?.length ?? 0) >=
            res.data.MediaContainer.totalSize
          ) {
            setHasMore(false);
          }
          onAppend(res.data.MediaContainer.Metadata);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setHasMore(true);
        setPage(0);
        setLoading(false);
      })
      .finally(() => {
        setLoading(false);
      });

    return () => {
      if (cancel) {
        cancel();
        setLoading(false);
      }
    };
  }, [page]);

  if (!hub.Metadata || hub.Metadata.length < 1) return null;

  return (
    <div className="w-[100%] overflow-x-hidden mb-10 last:mb-24">
      <button
        type="button"
        className="text-left flex flex-row items-center mx-10 md:mx-20 group gap-3 mb-4"
        onClick={() => {
          router.push(
            `${pathname}?${qs.stringify({ key: hub.key, libtitle: localizeHubTitle(hub.title), ...(id ? { contentDirectoryID: id } : {}) })}`,
            {
              scroll: false,
            },
          );
        }}
      >
        <span className="glass-pill rounded-full px-4 py-1.5 font-semibold text-sm md:text-base text-white/90 group-hover:text-white group-hover:bg-white/15 transition-all duration-200">
          {localizeHubTitle(hub.title)}
        </span>
        <div className="group-hover:opacity-100 group-hover:translate-x-0 mt-0.5 opacity-0 transition duration-200 -translate-x-full">
          <ChevronRight className="h-5 w-5 text-plex" />
        </div>
      </button>
      {hub.Metadata && (
        <Carousel
          edges={isTiny ? 40 : 80}
          spacing={6}
          scale={isContinueWatching ? 1 : isTiny ? 1.15 : 1.3}
          minimumVisibleItem={isOnDeck ? 1 : isTiny ? 2 : 3}
        >
          {hub.Metadata.map((item, index) => {
            const refKey = `${hub.hubIdentifier}-${item.ratingKey}-${item?.viewOffset ?? ""}-${item?.viewCount ?? ""}-${hub.Metadata?.length}`;
            return (
              <HubItem
                key={item.ratingKey}
                ref={
                  index ===
                  (hub.Metadata?.length ?? 0) -
                    ((hub.Metadata?.length ?? 0) > 6 ? 5 : 1)
                    ? lastRef
                    : undefined
                }
                refKey={refKey}
                item={item}
                index={index}
                isOnDeck={isOnDeck}
                isContinueWatching={isContinueWatching}
                onUpdate={(item) => {
                  onUpdate(item, index);
                }}
              />
            );
          })}
        </Carousel>
      )}
    </div>
  );
};
