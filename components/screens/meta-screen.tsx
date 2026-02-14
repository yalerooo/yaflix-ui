"use client";

import { FC, useContext, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ServerApi } from "@/api";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  ChevronRight,
  Play,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { EpisodePreviewItem } from "@/components/cards/episode-preview-item";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SeasonPreviewItem } from "@/components/cards/season-preview-item";
import {
  useItemChildren,
  useItemMetadata,
  useRelated,
} from "@/hooks/use-item-metadata";
import { useHubItem, useItemLanguages } from "@/hooks/use-hub-item";
import { usePreviewMuted } from "@/hooks/use-preview-muted";
import qs from "qs";
import { MetadataPreviewItem } from "@/components/cards/metadata-preview-item";
import { Skeleton } from "@/components/ui/skeleton";
import { CarouselContext } from "@/components/carousel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const MetaScreen: FC = () => {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const mid = searchParams.get("mid");
  const { close } = useContext(CarouselContext);
  const [episodeIndexCharCount, setEpisodeIndexCharCount] = useState(1);
  const [tab, setTab] = useState("");
  const { muted, toggleMuted } = usePreviewMuted();
  const { metadata, loading: loadingMetadata } = useItemMetadata(mid);
  const { related, loading: loadingRelated } = useRelated(metadata);
  const info = useHubItem(metadata, { fullSize: true });
  const season = useMemo(() => {
    if (!metadata) return null;
    if (info.isSeason) return metadata;
    if (metadata?.Children?.Metadata && metadata.Children.Metadata.length > 0) {
      return metadata.Children.Metadata[0];
    }
    return null;
  }, [metadata]);

  const { children: episodeChildren, loading: loadingEpisodeChildren } =
    useItemChildren(info.isEpisode ? metadata : null);
  const { children: seasonChildren, loading: loadingSeasonChildren } =
    useItemChildren(info.isSeason || info.isShow ? season : null);
  const { children: showChildren, loading: loadingShowChildren } =
    useItemChildren(
      info.isShow || info.isSeason || info.isEpisode
        ? ({
            ...metadata,
            type: "show",
            ratingKey: info.isSeason
              ? (metadata?.parentRatingKey ?? undefined)
              : info.isEpisode
                ? (metadata?.grandparentRatingKey ?? undefined)
                : (metadata?.ratingKey ?? undefined),
          } as Plex.Metadata)
        : null,
    );

  // const [preview, setPreview] = useState<string | null>(null);
  // const [playing, setPlaying] = useState<boolean>(false);

  const { languages, subtitles, process } = useItemLanguages();

  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!metadata) return;

    localStorage.setItem(
      "from-meta-screen",
      JSON.stringify({
        ratingKey: metadata.ratingKey,
        parentRatingKey: metadata.parentRatingKey ?? null,
        grandparentRatingKey: metadata.grandparentRatingKey ?? null,
      }),
    );

    const extras = metadata.Extras?.Metadata;
    if (!extras?.[0] || !extras?.[0]?.Media?.[0]?.Part?.[0]?.key) return;

    // setPreview(
    //   `${localStorage.getItem("server")}${
    //     extras?.[0]?.Media?.[0]?.Part?.[0]?.key
    //   }&X-Plex-Token=${localStorage.getItem("token")}`,
    // );

    // const timeout = setTimeout(() => {
    //   setPlaying(true);
    // }, 3000);
    //
    // return () => clearTimeout(timeout);
  }, [metadata?.ratingKey]);

  useEffect(() => {
    closeButtonRef.current?.scrollIntoView(false);
    // setPreview(null);
    // setPlaying(false);

    if (mid && close) close();
  }, [mid]);

  useEffect(() => {
    if (!metadata) return;

    setTab(
      metadata.type === "show"
        ? "seasons"
        : metadata.type === "episode" || metadata.type === "season"
          ? "episodes"
          : "related",
    );

    if (info.isSeason && seasonChildren && seasonChildren.length > 0) {
      setEpisodeIndexCharCount(
        seasonChildren.reduce((max, e) => {
          if (!e.index) return max;
          const v = e.index === 0 ? 1 : Math.abs(e.index).toString().length;
          return max < v ? v : max;
        }, 0),
      );
    }

    if (info.isEpisode || info.isMovie) {
      if (
        metadata.Media?.length &&
        metadata.Media[0].Part?.length &&
        metadata.Media[0].Part[0].Stream?.length
      ) {
        process(metadata.Media[0].Part[0].Stream);
        return;
      }
    }

    if (info.isSeason || info.isShow) {
      if (!seasonChildren || seasonChildren.length === 0) return;

      // get the first episode to get the languages and subtitles
      // you need to request the full metadata for the episode to get the media info
      ServerApi.metadata({ id: seasonChildren[0].ratingKey }).then((data) => {
        if (
          data &&
          data.Media?.length &&
          data.Media[0].Part?.length &&
          data.Media[0].Part[0].Stream?.length
        ) {
          process(data.Media[0].Part[0].Stream);
        }
      });
    }
  }, [metadata, seasonChildren]);

  const handleBack = () => {
    router.back();
  };

  const handleClose = () => {
    router.replace(pathname, { scroll: false });
  };

  const handleOpenGrandparent = () => {
    if (!metadata?.grandparentRatingKey) return;
    router.push(`${pathname}?mid=${metadata.grandparentRatingKey}`, {
      scroll: false,
    });
  };

  const handleOpenParent = () => {
    if (!metadata?.parentRatingKey) return;
    router.push(`${pathname}?mid=${metadata.parentRatingKey}`, {
      scroll: false,
    });
  };

  const handleOpen = (ratingKey: string) => {
    router.push(`${pathname}?mid=${ratingKey}`, {
      scroll: false,
    });
  };

  return (
    <Dialog
      open={!!mid}
      onOpenChange={(open) => {
        if (!open) router.replace(pathname, { scroll: false });
      }}
    >
      <DialogContent className="w-full p-0 max-w-[min(1500px,calc(100%-2rem))] h-full max-h-[calc(100%-2rem)] overflow-hidden z-[50]">
        <VisuallyHidden>
          <DialogTitle>Item metadata dialog</DialogTitle>
        </VisuallyHidden>
        <ScrollArea>
          <div className="max-w-full w-full rounded-lg h-full overflow-auto relative">
            {info.coverImage && metadata ? (
              <div className="absolute top-0 right-0 left-0 z-0 max-w-full previewPlayerContainerRef">
                {/*{playing ? (*/}
                {/*  <ReactPlayer*/}
                {/*    url={preview!}*/}
                {/*    controls={false}*/}
                {/*    width="100%"*/}
                {/*    height="100%"*/}
                {/*    autoPlay*/}
                {/*    playing={playing}*/}
                {/*    volume={muted ? 0 : 0.5}*/}
                {/*    muted={muted}*/}
                {/*    onEnded={() => setPlaying(false)}*/}
                {/*    onError={() => setPlaying(false)}*/}
                {/*    pip={false}*/}
                {/*    config={{*/}
                {/*      file: { attributes: { disablePictureInPicture: true } },*/}
                {/*    }}*/}
                {/*  />*/}
                {/*) : (*/}
                <img
                  className="w-full"
                  src={info.coverImage}
                  alt="preview image"
                />
                {/*)}*/}
                <div
                  className="absolute inset-0"
                  style={{
                    background:
                      "linear-gradient(0, hsl(var(--background)), rgba(0, 0, 0, 0.8), rgba(0, 0, 0, 0.4), rgba(0, 0, 0, 0.1))",
                  }}
                />
                <div className="absolute top-0 left-0 m-4 flex flex-col gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleBack}
                    type="button"
                  >
                    <ArrowLeft />
                  </Button>
                </div>
                <div className="absolute top-0 right-0 m-4 flex flex-col gap-2">
                  <Button
                    ref={closeButtonRef}
                    variant="outline"
                    size="icon"
                    onClick={handleClose}
                    type="button"
                  >
                    <X />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={toggleMuted}
                    type="button"
                  >
                    {muted ? (
                      <VolumeX className="w-4 h-4" />
                    ) : (
                      <Volume2 className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="absolute top-0 right-0 m-4 flex flex-col gap-2">
                <Button
                  ref={closeButtonRef}
                  variant="outline"
                  size="icon"
                  onClick={handleClose}
                  type="button"
                >
                  <X />
                </Button>
              </div>
            )}
            <div className="relative md:mt-96 mt-56 z-50">
              <div className="px-4 sm:px-10 md:px-20 pt-0 pb-20 flex flex-col gap-6">
                <div className="flex flex-row gap-6 items-center justify-start">
                  {loadingMetadata ? (
                    <Skeleton className="hidden [@media(min-width:1200px)]:block rounded min-w-[300px] min-h-[450px]" />
                  ) : (
                    <img
                      className="hidden [@media(min-width:1200px)]:block rounded w-[300px] h-[450px] object-cover"
                      src={info.posterImage}
                      alt="element poster"
                    />
                  )}
                  <div className="flex flex-col gap-6 w-full">
                    <div className="flex flex-col gap-2">
                      {loadingMetadata ? (
                        <Skeleton className="h-10" />
                      ) : (
                        <p className="font-bold text-lg sm:text-xl md:text-3xl lg:text-4xl xl:text-5xl">
                          {metadata?.title}
                        </p>
                      )}
                      {info.isEpisode && (
                        <button
                          type="button"
                          className="w-fit"
                          onClick={handleOpenGrandparent}
                        >
                          <p className="font-bold text-muted-foreground [@media(min-width:1200px)]:line-clamp-2 hover:text-primary text-left">
                            {metadata?.grandparentTitle}
                          </p>
                        </button>
                      )}
                      {info.isSeason && (
                        <button
                          type="button"
                          className="w-fit text-muted-foreground hover:text-primary text-left"
                          onClick={handleOpenParent}
                        >
                          <p className="font-bold text-muted-foreground [@media(min-width:1200px)]:line-clamp-2 hover:text-primary text-left">
                            {metadata?.parentTitle}
                          </p>
                        </button>
                      )}
                      {info.isShow && (
                        <p className="font-bold text-muted-foreground max-w-4xl line-clamp-3 flex flex-row items-center gap-4">
                          <span>
                            {info.childCount} Season
                            {(info.childCount ?? 0) > 1 ? "s" : ""}
                          </span>
                          <span>
                            {info.leafCount} Episode
                            {(info.leafCount ?? 0) > 1 ? "s" : ""}
                          </span>
                        </p>
                      )}
                      {info.isSeason && (
                        <p className="font-bold text-muted-foreground max-w-4xl line-clamp-3 flex flex-row items-center gap-4">
                          <span>
                            {info.leafCount} Episode
                            {(info.leafCount ?? 0) > 1 ? "s" : ""}
                          </span>
                        </p>
                      )}
                      {info.isEpisode && (
                        <p className="text-muted-foreground font-bold max-w-4xl line-clamp-3 flex flex-row items-center gap-4">
                          <button
                            onClick={handleOpenParent}
                            type="button"
                            className="hover:text-primary"
                          >
                            Season {metadata?.parentIndex}
                          </button>
                          <span>Episode {metadata?.index}</span>
                        </p>
                      )}
                      {metadata?.contentRating && (
                        <div className="flex items-center font-semibold gap-2 w-full pt-1">
                          {metadata?.contentRating && (
                            <p className="border border-muted-foreground rounded-sm px-1 text-sm">
                              {metadata?.contentRating}
                            </p>
                          )}
                          {metadata?.editionTitle && (
                            <p className="border border-plex rounded-sm px-1 text-plex text-sm">
                              {metadata.editionTitle}
                            </p>
                          )}
                          {metadata?.year && (
                            <p className="px-1 text-sm">{metadata.year}</p>
                          )}
                        </div>
                      )}
                    </div>
                    {!loadingMetadata && (
                      <div className="flex flex-row gap-4">
                        <Button
                          variant="default"
                          onClick={info.play}
                          className="w-fit font-bold"
                        >
                          <Play fill="currentColor" /> Play
                          {info.playable
                            ? `${info.playable.season !== null ? ` S${info.playable.season}` : ""}${info.playable.episode !== null ? ` E${info.playable.episode}` : ""}`
                            : null}
                        </Button>
                        {/*<Dialog>*/}
                        {/*  <DialogTrigger>*/}
                        {/*    <Button*/}
                        {/*      variant="default"*/}
                        {/*      size="icon"*/}
                        {/*      className="font-bold"*/}
                        {/*    >*/}
                        {/*      <Info />*/}
                        {/*    </Button>*/}
                        {/*  </DialogTrigger>*/}
                        {/*  <DialogContent className="shadow-2xl">*/}
                        {/*    <DialogHeader>*/}
                        {/*      <DialogTitle>More Options</DialogTitle>*/}
                        {/*    </DialogHeader>*/}
                        {/*    <Button variant="outline" className="w-full">*/}
                        {/*      Mark as watched*/}
                        {/*    </Button>*/}
                        {/*  </DialogContent>*/}
                        {/*</Dialog>*/}
                      </div>
                    )}
                    <div className="space-y-2">
                      {loadingMetadata ? (
                        <>
                          <Skeleton className="h-5 w-[350px]" />
                          <Skeleton className="h-5 w-[450px]" />
                          <Skeleton className="h-5 w-[550px]" />
                        </>
                      ) : (
                        <>
                          {metadata?.Genre && (
                            <InfoList
                              title="Genre"
                              infos={metadata.Genre.map((g) => g.tag)}
                            />
                          )}
                          <InfoList title="Languages" infos={languages} />
                          <InfoList title="Subtitles" infos={subtitles} />
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="space-y-6">
                  {loadingMetadata ? (
                    <div className="space-y-2">
                      <Skeleton className="h-4" />
                      <Skeleton className="h-4" />
                      <Skeleton className="h-4" />
                    </div>
                  ) : (
                    <p className="font-bold text-muted-foreground line-clamp-3">
                      {metadata?.summary}
                    </p>
                  )}

                  {metadata && (
                    <Tabs value={tab} onValueChange={(value) => setTab(value)}>
                      <TabsList>
                        {metadata.type === "show" && (
                          <TabsTrigger value="seasons">SEASONS</TabsTrigger>
                        )}
                        {(metadata.type === "season" ||
                          metadata.type === "episode") && (
                          <TabsTrigger value="episodes">EPISODES</TabsTrigger>
                        )}
                        <TabsTrigger value="related">
                          MORE LIKE THIS
                        </TabsTrigger>
                      </TabsList>

                      <TabsContent value="seasons" className="space-y-6">
                        {info.isShow &&
                          (loadingShowChildren ? (
                            <div className="space-y-6">
                              <Skeleton className="h-7 w-[20ch]" />
                              <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                                {Array.from({ length: 4 }).map((_, i) => (
                                  <div className="w-full space-y-3" key={i}>
                                    <Skeleton className="aspect-[9/14] w-full rounded" />
                                    <Skeleton className="h-5 w-[10ch]" />
                                    <Skeleton className="h-4 w-[15ch]" />
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : (
                            showChildren &&
                            showChildren.length > 0 && (
                              <div className="space-y-6">
                                <p className="font-bold text-lg md:text-2xl">
                                  {showChildren.length} Season
                                  {showChildren.length > 1 ? "s" : ""}
                                </p>
                                <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                                  {showChildren.map((child) => (
                                    <SeasonPreviewItem
                                      key={child.ratingKey}
                                      season={child}
                                    />
                                  ))}
                                </div>
                              </div>
                            )
                          ))}
                      </TabsContent>

                      <TabsContent value="episodes" className="space-y-6">
                        {info.isSeason &&
                          (loadingSeasonChildren ? (
                            <div className="space-y-6">
                              <Skeleton className="h-7 w-[20ch]" />
                              <div className="flex flex-col w-full">
                                {Array.from({ length: 5 }).map((_, i) => (
                                  <div
                                    key={i}
                                    className="flex flex-row items-center p-4 group transition hover:bg-secondary w-full border-b-2 justify-start text-left"
                                  >
                                    <Skeleton className="w-[8px] h-[28px] mr-4" />
                                    <div className="pr-4 min-w-[150px] w-[150px] sm:min-w-[200px] sm:w-[200px] md:min-w-[250px] md:w-[250px] relative">
                                      <Skeleton className="aspect-video w-full" />
                                    </div>
                                    <div className="w-full">
                                      <Skeleton className="w-full sm:w-[200px] h-[22px] mb-1" />
                                      <Skeleton className="h-[22px] w-full" />
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : (
                            seasonChildren &&
                            seasonChildren.length > 0 && (
                              <div className="space-y-6">
                                <div className="flex justify-between">
                                  <p className="font-bold text-lg md:text-2xl">
                                    {seasonChildren.length} Episode
                                    {seasonChildren.length > 1 ? "s" : ""}
                                  </p>
                                  {showChildren && showChildren.length > 1 && (
                                    <Select
                                      onValueChange={(value) =>
                                        handleOpen(value)
                                      }
                                      value={metadata.ratingKey}
                                    >
                                      <SelectTrigger className="max-w-fit gap-2">
                                        <SelectValue
                                          placeholder={metadata.title}
                                        />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {showChildren.map((child) => (
                                          <SelectItem
                                            key={child.ratingKey}
                                            value={child.ratingKey}
                                          >
                                            {child.title}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  )}
                                </div>
                                <div className="flex flex-col w-full">
                                  {seasonChildren.map((child) => (
                                    <EpisodePreviewItem
                                      key={child.ratingKey}
                                      item={child}
                                      count={episodeIndexCharCount}
                                    />
                                  ))}
                                </div>
                              </div>
                            )
                          ))}

                        {info.isEpisode &&
                          (loadingEpisodeChildren ? (
                            <div className="space-y-6">
                              <Skeleton className="h-7 w-[20ch]" />
                              <div className="flex flex-col w-full">
                                {Array.from({ length: 5 }).map((_, i) => (
                                  <div
                                    key={i}
                                    className="flex flex-row items-center p-4 group transition hover:bg-secondary w-full border-b-2 justify-start text-left"
                                  >
                                    <Skeleton className="w-[8px] h-[28px] mr-4" />
                                    <div className="pr-4 min-w-[150px] w-[150px] sm:min-w-[200px] sm:w-[200px] md:min-w-[250px] md:w-[250px] relative">
                                      <Skeleton className="aspect-video w-full" />
                                    </div>
                                    <div className="w-full">
                                      <Skeleton className="w-full sm:w-[200px] h-[22px] mb-1" />
                                      <Skeleton className="h-[22px] w-full" />
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : (
                            episodeChildren &&
                            episodeChildren.length > 0 && (
                              <div className="space-y-6">
                                <div className="flex justify-between">
                                  <p className="font-bold text-lg md:text-2xl">
                                    {episodeChildren.length} Episode
                                    {episodeChildren.length > 1 ? "s" : ""}
                                  </p>
                                  {showChildren && showChildren.length > 1 && (
                                    <Select
                                      onValueChange={(value) =>
                                        handleOpen(value)
                                      }
                                      value={metadata.parentRatingKey}
                                    >
                                      <SelectTrigger className="max-w-fit gap-2">
                                        <SelectValue
                                          placeholder={metadata.title}
                                        />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {showChildren.map((child) => (
                                          <SelectItem
                                            key={child.ratingKey}
                                            value={child.ratingKey}
                                          >
                                            {child.title}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  )}
                                </div>
                                <div className="flex flex-col w-full">
                                  {episodeChildren.map((child) => (
                                    <EpisodePreviewItem
                                      key={child.ratingKey}
                                      selected={child.ratingKey === mid}
                                      item={child}
                                      count={episodeIndexCharCount}
                                    />
                                  ))}
                                </div>
                              </div>
                            )
                          ))}
                      </TabsContent>

                      <TabsContent value="related" className="space-y-6">
                        {related &&
                          (loadingRelated ? (
                            <div className="space-y-6">
                              <Skeleton className="h-7 w-[20ch]" />
                              <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                                {Array.from({ length: 5 }).map((_, i) => (
                                  <div
                                    className="bg-alternative rounded"
                                    key={i}
                                  >
                                    <Skeleton
                                      key={i}
                                      className="aspect-video w-full rounded-b-none"
                                    />
                                    <div className="p-4 space-y-4">
                                      <Skeleton className="h-6 w-[25ch]" />
                                      <div className="space-y-2">
                                        <Skeleton className="h-3" />
                                        <Skeleton className="h-3" />
                                        <Skeleton className="h-3" />
                                        <Skeleton className="h-3" />
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : (
                            related.map((hub, i) => (
                              <div
                                key={`${hub.title}-${i}`}
                                className="flex flex-col gap-6"
                              >
                                <button
                                  type="button"
                                  className="text-left group w-full flex flex-row items-center gap-2"
                                  onClick={() => {
                                    router.push(
                                      `${pathname}?${qs.stringify({ key: hub.key, libtitle: hub.title })}`,
                                      {
                                        scroll: false,
                                      },
                                    );
                                  }}
                                >
                                  <p className="font-bold text-2xl">
                                    {hub.title}
                                  </p>
                                  <div className="group-hover:opacity-100 group-hover:translate-x-0 opacity-0 transition duration-150 -translate-x-full">
                                    <ChevronRight className="h-6 w-6 text-plex" />
                                  </div>
                                </button>
                                <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                                  {hub.Metadata?.slice(0, 15)

                                    .map((item, i) => (
                                      <MetadataPreviewItem
                                        key={i}
                                        item={item}
                                      />
                                    ))}
                                </div>
                              </div>
                            ))
                          ))}
                      </TabsContent>
                    </Tabs>
                  )}
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

const InfoList: FC<{ title: string; infos: string[] | undefined }> = ({
  infos,
  title,
}) => {
  if (!infos) return;
  if (infos.length === 0) return;
  return (
    <div className="font-bold line-clamp-1">
      <span className="text-muted-foreground pr-2">{title}</span>
      {infos.map((info, i, arr) => (
        <span key={info}>
          {" "}
          {info}
          {i !== arr.length - 1 ? "," : ""}
        </span>
      ))}
    </div>
  );
};
