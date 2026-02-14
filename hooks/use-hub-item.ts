import { usePathname, useRouter, useSearchParams } from "next/navigation";
import qs from "qs";
import { useState } from "react";
import { ServerApi } from "@/api";

export const getCoverImage = (
  url: string,
  fullSize: boolean = false,
  higherResolution: boolean = false,
) => {
  const token = localStorage.getItem("token");
  const server = localStorage.getItem("server");

  if (fullSize) return `${server}${url}?X-Plex-Token=${token}`;

  const width = 300,
    height = 168;

  return `${server}/photo/:/transcode?${qs.stringify({
    width: higherResolution ? width * 1.5 : width,
    height: higherResolution ? height * 1.5 : height,
    url: `${url}?X-Plex-Token=${token}`,
    minSize: 1,
    upscale: 1,
    "X-Plex-Token": token,
  })}`;
};

export const getPosterImage = (
  url: string,
  fullSize: boolean = false,
  higherResolution: boolean = false,
) => {
  const token = localStorage.getItem("token");
  const server = localStorage.getItem("server");

  if (fullSize) return `${server}${url}?X-Plex-Token=${token}`;

  const width = 300,
    height = 450;

  return `${server}/photo/:/transcode?${qs.stringify({
    width: higherResolution ? width * 1.5 : width,
    height: higherResolution ? height * 1.5 : height,
    url: `${url}?X-Plex-Token=${token}`,
    minSize: 1,
    upscale: 1,
    "X-Plex-Token": token,
  })}`;
};

type Item = Plex.Metadata | Plex.HubMetadata;

type IsType = {
  episode: boolean;
  season: boolean;
  show: boolean;
  movie: boolean;
};

const extractIsType = (type: Plex.LibraryType): IsType => {
  const episode = type === "episode";
  const season = type === "season";
  const show = type === "show";
  const movie = type === "movie";
  return { episode, season, show, movie };
};

const extractGuidNumber = (inputString: string | undefined) => {
  if (!inputString) return null;
  const match = inputString.match(/plex:\/\/\w+\/([a-zA-Z0-9]+)/);
  return match ? match[1] : null;
};

export const extractClearLogo = (item: Plex.Metadata | Plex.HubMetadata) => {
  const logoUrl = item?.Image?.find((i) => i.type === "clearLogo")?.url;
  if (logoUrl) {
    const token = localStorage.getItem("token");
    const server = localStorage.getItem("server");

    return `${server}${logoUrl}?X-Plex-Token=${token}`;
  }
  return null;
};

const extractProgress = (isType: IsType, item: Item): number => {
  if (isType.movie || isType.episode) {
    if (item.viewOffset)
      return Math.floor((item.viewOffset / item.duration) * 100);
    if ((item.viewCount ?? 0) >= 1) return 100;
  }
  return 0;
};

const extractWatched = (
  isType: IsType,
  item: Item,
  progress: number,
): boolean => {
  if (isType.show || isType.season) {
    return item.leafCount === item.viewedLeafCount;
  }
  if (isType.movie || isType.episode) {
    return progress === 100;
  }
  return false;
};

const extractChildCount = (item: Item): number | null => {
  return item.childCount ?? null;
};

const extractLeafCount = (item: Item): number | null => {
  return item.leafCount ?? null;
};

type ItemDuration = {
  total: number; // total minute
  minutes: number; // minutes without hours
  hours: number; // hours
};

const extractDuration = (isType: IsType, item: Item): ItemDuration | null => {
  if (isType.movie || isType.episode) {
    const total = Math.floor(item.duration / 1000 / 60);
    const hours = Math.floor(total / 60);
    return { total, hours, minutes: total - hours * 60 };
  }
  return null;
};

export const extractCoverImage = (
  isType: IsType,
  item: Item,
  fullSize: boolean = false,
  higherResolution: boolean = false,
): string => {
  if (isType.movie || isType.episode) {
    return getCoverImage(item.art, fullSize, higherResolution);
  }
  return getCoverImage(
    item.grandparentArt ?? item.art,
    fullSize,
    higherResolution,
  );
};

export const extractPosterImage = (
  isType: IsType,
  item: Item,
  fullSize: boolean = false,
  higherResolution: boolean = false,
): string => {
  if (isType.episode) {
    return getPosterImage(
      item.parentThumb ?? item.grandparentThumb ?? item.thumb,
      fullSize,
      higherResolution,
    );
  }
  if (isType.season) {
    return getPosterImage(
      item.thumb ?? item.parentThumb,
      fullSize,
      higherResolution,
    );
  }
  return getPosterImage(item.thumb, fullSize, higherResolution);
};

type Playable = {
  season: number | null;
  episode: number | null;
  viewOffset: number | null;
  ratingKey: number | string | null;
};

const extractPlayable = (isType: IsType, item: Item): Playable => {
  let viewOffset = item.viewOffset ?? null;
  let ratingKey = item.ratingKey;
  let episode = null;
  let season = null;
  if ((isType.show || isType.season) && item.OnDeck?.Metadata) {
    if (item.Children?.size) {
      season = item.OnDeck.Metadata.parentIndex ?? null;
    }
    episode = item.OnDeck.Metadata.index ?? null;
    viewOffset = item.OnDeck.Metadata.viewOffset ?? null;
    ratingKey = item.OnDeck.Metadata.ratingKey ?? null;
  }
  return { viewOffset, ratingKey, episode, season };
};

const extractQuality = (isType: IsType, item: Item): string | null => {
  if ((isType.movie || isType.episode) && item.Media && item.Media.length > 0) {
    return item.Media[0].videoResolution;
  }
  return null;
};

export type HubItemInfo =
  | {
      isEpisode: boolean;
      isSeason: boolean;
      isShow: boolean;
      isMovie: boolean;
      guid: null;
      watched: null;
      progress: null;
      childCount: null;
      leafCount: null;
      duration: null;
      quality: null;
      playable: null;
      coverImage: string;
      posterImage: string;
      clearLogo: null;
      play: () => null;
      open: () => null;
    }
  | {
      isEpisode: boolean;
      isSeason: boolean;
      isShow: boolean;
      isMovie: boolean;
      guid: null | string;
      watched: boolean;
      progress: number;
      childCount: number | null;
      leafCount: number | null;
      duration: ItemDuration | null;
      quality: string | null;
      playable: Playable;
      coverImage: string;
      posterImage: string;
      clearLogo: string | null;
      play: () => void;
      open: (mid?: string) => void;
    };

export const useHubItem = (
  item?: Item | null | undefined,
  options: { fullSize?: boolean; higherResolution?: boolean } = {},
): HubItemInfo => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (!item) {
    return {
      isEpisode: false,
      isSeason: false,
      isShow: false,
      isMovie: false,
      guid: null,
      watched: null,
      progress: null,
      childCount: null,
      leafCount: null,
      duration: null,
      quality: null,
      playable: null,
      coverImage: "",
      posterImage: "",
      clearLogo: null,
      play: () => null,
      open: () => null,
    };
  }

  const isType = extractIsType(item.type);
  const coverImage = extractCoverImage(
    isType,
    item,
    options.fullSize ?? false,
    options.higherResolution ?? false,
  );
  const posterImage = extractPosterImage(
    isType,
    item,
    options.fullSize ?? false,
    options.higherResolution ?? false,
  );
  const guid = extractGuidNumber(item.guid);
  const progress = extractProgress(isType, item);
  const watched = extractWatched(isType, item, progress);
  const childCount = extractChildCount(item);
  const leafCount = extractLeafCount(item);
  const duration = extractDuration(isType, item);
  const playable = extractPlayable(isType, item);
  const quality = extractQuality(isType, item);
  const clearLogo = extractClearLogo(item);

  const open = (mid: string = item.ratingKey) => {
    if (searchParams.get("mid") !== mid) {
      router.push(`${pathname}?mid=${mid}`, {
        scroll: false,
      });
    }
  };

  const play = () => {
    if (isType.movie) {
      router.push(
        `${pathname}?watch=${item.ratingKey}${item.viewOffset ? `&t=${item.viewOffset}` : ""}`,
        { scroll: false },
      );
      return;
    }
    if (isType.episode) {
      router.push(
        `${pathname}?watch=${item.ratingKey.toString()}${item.viewOffset ? `&t=${item.viewOffset}` : ""}`,
        { scroll: false },
      );
      return;
    }
    if (isType.show || isType.season) {
      if (item.OnDeck && item.OnDeck.Metadata) {
        router.push(
          `${pathname}?watch=${item.OnDeck.Metadata.ratingKey}${
            item.OnDeck.Metadata.viewOffset
              ? `&t=${item.OnDeck.Metadata.viewOffset}`
              : ""
          }`,
          { scroll: false },
        );
        return;
      }
      const season = isType.season
        ? item
        : item.Children?.Metadata.find((s) => s.title !== "Specials");
      if (!season) return;

      ServerApi.children({
        id: season.ratingKey as string,
      }).then((eps) => {
        if (!eps) return;

        router.push(`${pathname}?watch=${eps[0].ratingKey}`, {
          scroll: false,
        });
        return;
      });
    }
  };

  return {
    isEpisode: isType.episode,
    isSeason: isType.season,
    isShow: isType.show,
    isMovie: isType.movie,
    guid,
    watched,
    progress,
    childCount,
    leafCount,
    duration,
    quality,
    playable,
    coverImage,
    posterImage,
    clearLogo,
    play,
    open,
  };
};

export const extractLanguages = (
  streams: Plex.Stream[],
): [Set<string>, Set<string>] => {
  const dub = new Set<string>();
  const sub = new Set<string>();
  streams.forEach((curr) => {
    if (curr.streamType === 2) {
      dub.add(curr.language ?? curr.displayTitle ?? curr.extendedDisplayTitle);
    } else if (curr.streamType === 3) {
      sub.add(curr.language ?? curr.displayTitle ?? curr.extendedDisplayTitle);
    }
  });
  return [dub, sub];
};

export const useItemLanguages = () => {
  const [languages, setLanguages] = useState<string[]>([]);
  const [subtitles, setSubtitles] = useState<string[]>([]);

  const process = (streams: Plex.Stream[]) => {
    const [dub, sub] = extractLanguages(streams);
    setLanguages(Array.from(dub));
    setSubtitles(Array.from(sub));
  };

  return { languages, subtitles, process };
};
