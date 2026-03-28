"use client";

import { FC, useContext, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ServerApi } from "@/api";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  Play,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  useItemChildren,
  useItemMetadata,
  useRelated,
} from "@/hooks/use-item-metadata";
import { useHubItem, useItemLanguages } from "@/hooks/use-hub-item";
import { usePreviewMuted } from "@/hooks/use-preview-muted";
import qs from "qs";
import { CarouselContext } from "@/components/carousel";
import { cn } from "@/lib/utils";
import { getSeriesLogo } from "@/lib/fanart";
import { useSession } from "@/hooks/use-session";
import { useQueryClient } from "@tanstack/react-query";
import {
  extractTmdbId,
  extractTmdbIdFromGuids,
  extractTvdbId,
  extractTvdbIdFromGuids,
  fetchMovieArtwork,
  fetchTvShowArtwork,
} from "@/lib/fanart";
import { useSettings } from "@/components/settings-provider";
import { useServer } from "@/components/server-provider";
import { MetadataEditorDialog } from "@/components/metadata-editor-dialog";

function plexImage(path: string | undefined, width?: number, height?: number): string {
  if (!path) return '';
  const server = localStorage.getItem('server') || '';
  const token = localStorage.getItem('token') || '';
  // If path is already a full URL, proxy it through Plex photo transcoder
  if (path.startsWith('http://') || path.startsWith('https://')) {
    const params = new URLSearchParams({
      url: path,
      'X-Plex-Token': token,
      ...(width ? { width: String(width) } : {}),
      ...(height ? { height: String(height) } : {}),
      minSize: '1',
      upscale: '1',
    });
    return `${server}/photo/:/transcode?${params.toString()}`;
  }
  // Relative path — append directly to server
  return `${server}${path}?X-Plex-Token=${token}`;
}

export const MetaScreenYaflix: FC = () => {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { user } = useSession();
  const { t } = useSettings();
  const { libraries, disabledLibraries } = useServer();
  const mid = searchParams.get("mid");
  const { close } = useContext(CarouselContext);
  const [activeTab, setActiveTab] = useState("general");
  const [selectedSeason, setSelectedSeason] = useState<string | null>(null);
  const [fanartLogo, setFanartLogo] = useState<string | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const [nextEpisodeInfo, setNextEpisodeInfo] = useState<{ season: number | null; episode: number | null } | null>(null);
  const [selectedAudioStream, setSelectedAudioStream] = useState<string | null>(null);
  const [selectedSubtitleStream, setSelectedSubtitleStream] = useState<string | null>(null);
  const [isMetadataEditorOpen, setMetadataEditorOpen] = useState(false);
  const [metadataSaveError, setMetadataSaveError] = useState<string | null>(null);
  const [savingMetadata, setSavingMetadata] = useState(false);
  const [isImageEditorOpen, setImageEditorOpen] = useState(false);
  const [imageSaveError, setImageSaveError] = useState<string | null>(null);
  const [savingImages, setSavingImages] = useState(false);
  const [reanalyzing, setReanalyzing] = useState(false);
  const [reanalyzeMessage, setReanalyzeMessage] = useState<string | null>(null);
  const autoEditOpenedForMidRef = useRef<string | null>(null);
  const [loadingImageSuggestions, setLoadingImageSuggestions] = useState(false);
  const [imageSuggestions, setImageSuggestions] = useState<{
    poster: string[];
    art: string[];
    thumb: string[];
  }>({
    poster: [],
    art: [],
    thumb: [],
  });

  const localizeSeasonTitle = (title: string) => {
    const match = title.match(/^season\s+(\d+)$/i);
    if (!match) return title;
    return `${t("common.season")} ${match[1]}`;
  };
  const [metadataForm, setMetadataForm] = useState({
    title: "",
    titleSort: "",
    originalTitle: "",
    summary: "",
    tagline: "",
    studio: "",
    originallyAvailableAt: "",
    contentRating: "",
    year: "",
    index: "",
    parentIndex: "",
    posterUrl: "",
    artUrl: "",
    thumbUrl: "",
  });
  const { muted, toggleMuted } = usePreviewMuted();
  const { metadata, loading: loadingMetadata } = useItemMetadata(mid);
  const { related, loading: loadingRelated } = useRelated(metadata);
  const info = useHubItem(metadata, { fullSize: true });
  const isAdmin = useMemo(() => {
    if (!user) return false;
    const sessionUser = user as Plex.UserData & {
      homeAdmin?: boolean;
      restricted?: boolean;
    };
    if (typeof sessionUser.homeAdmin === "boolean") return sessionUser.homeAdmin;
    if (typeof sessionUser.restricted === "boolean") return !sessionUser.restricted;
    return !!sessionUser.email;
  }, [user]);
  const canEditCurrentMetadata =
    isAdmin &&
    !!metadata &&
    (metadata.type === "movie" ||
      metadata.type === "show" ||
      metadata.type === "season" ||
      metadata.type === "episode");
  
  const season = useMemo(() => {
    if (!metadata) return null;
    if (info.isSeason) return metadata;
    if (metadata?.Children?.Metadata && metadata.Children.Metadata.length > 0) {
      return selectedSeason 
        ? metadata.Children.Metadata.find(s => s.ratingKey === selectedSeason) || metadata.Children.Metadata[0]
        : metadata.Children.Metadata[0];
    }
    return null;
  }, [metadata, selectedSeason]);

  // Flatten related hubs into a single array of metadata (deduplicated)
  const relatedItems = useMemo(() => {
    if (!related || related.length === 0) return [];
    const all = related.flatMap((hub) => hub.Metadata || []);
    const seen = new Set<string>();
    return all.filter((item) => {
      const key = String(item.ratingKey);
      if (!item.ratingKey || seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 15);
  }, [related]);

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

  // Load saved audio/subtitle preferences
  useEffect(() => {
    if (!metadata) return;
    const savedAudio = localStorage.getItem(`audio_${metadata.ratingKey}`);
    const savedSubtitle = localStorage.getItem(`subtitle_${metadata.ratingKey}`);
    if (savedAudio) setSelectedAudioStream(savedAudio);
    if (savedSubtitle) setSelectedSubtitleStream(savedSubtitle);
  }, [metadata]);

  // Calculate next episode to play
  useEffect(() => {
    if (!metadata || (!info.isShow && !info.isSeason)) {
      setNextEpisodeInfo(null);
      return;
    }

    const calculateNextEpisode = async () => {
      let episodeToPlay: Plex.Metadata | undefined;

      // Check current season first for in-progress episodes
      if (seasonChildren) {
        episodeToPlay = seasonChildren.find(
          (ep) => ep.viewOffset && ep.viewOffset > 0 && (!ep.viewCount || ep.viewCount === 0)
        );
      }

      // If no in-progress, search all seasons from the beginning
      if (!episodeToPlay && showChildren && showChildren.length > 0) {
        for (const seasonMeta of showChildren) {
          try {
            const seasonEpisodes = await ServerApi.children({ id: seasonMeta.ratingKey });
            if (seasonEpisodes) {
              // Find in-progress episode first
              const inProgress = seasonEpisodes.find(
                (ep) => ep.viewOffset && ep.viewOffset > 0 && (!ep.viewCount || ep.viewCount === 0)
              );
              if (inProgress) {
                episodeToPlay = inProgress;
                break;
              }
              // Then find unwatched
              const unwatched = seasonEpisodes.find(
                (ep) => !ep.viewCount || ep.viewCount === 0
              );
              if (unwatched) {
                episodeToPlay = unwatched;
                break;
              }
            }
          } catch (error) {
            console.error("Error fetching season episodes:", error);
          }
        }
      }

      // Fallback to first unwatched in current season
      if (!episodeToPlay && seasonChildren) {
        episodeToPlay = seasonChildren.find(
          (ep) => !ep.viewCount || ep.viewCount === 0
        );
      }

      // Set the info
      if (episodeToPlay) {
        setNextEpisodeInfo({
          season: episodeToPlay.parentIndex ?? null,
          episode: episodeToPlay.index ?? null,
        });
      } else {
        setNextEpisodeInfo(null);
      }
    };

    calculateNextEpisode();
  }, [metadata, info.isShow, info.isSeason, seasonChildren, showChildren]);

  const { languages, subtitles, process } = useItemLanguages();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const episodesScrollRef = useRef<HTMLDivElement>(null);

  // Extract audio and subtitle options
  const audioOptions = useMemo(
    () =>
      metadata?.Media && metadata.Media.length > 0
        ? metadata?.Media[0].Part[0].Stream.filter(
            (stream) => stream.streamType === 2,
          )
        : [],
    [metadata?.Media],
  );
  
  const subtitleOptions = useMemo(
    () =>
      metadata?.Media && metadata.Media.length > 0
        ? metadata?.Media[0].Part[0].Stream.filter(
            (stream) => stream.streamType === 3,
          )
        : [],
    [metadata?.Media],
  );

  // Load saved audio/subtitle preferences or set defaults from currently selected
  useEffect(() => {
    if (!metadata?.Media || !metadata.Media[0]?.Part[0]?.Stream) return;
    
    const streams = metadata.Media[0].Part[0].Stream;
    const savedAudio = localStorage.getItem(`audio_${metadata.ratingKey}`);
    const savedSubtitle = localStorage.getItem(`subtitle_${metadata.ratingKey}`);

    const audioStreamIds = new Set(
      streams.filter((s) => s.streamType === 2).map((s) => s.id.toString())
    );
    const subtitleStreamIds = new Set(
      streams.filter((s) => s.streamType === 3).map((s) => s.id.toString())
    );
    
    // Set audio: saved preference (only if stream still exists), or currently selected, or first audio stream
    const validSavedAudio = savedAudio && audioStreamIds.has(savedAudio) ? savedAudio : null;
    if (!validSavedAudio && savedAudio) {
      // Stream no longer exists — clear stale preference
      localStorage.removeItem(`audio_${metadata.ratingKey}`);
    }
    if (validSavedAudio) {
      setSelectedAudioStream(validSavedAudio);
    } else {
      const currentAudio = streams.find((s) => s.streamType === 2 && s.selected);
      if (currentAudio) {
        setSelectedAudioStream(currentAudio.id.toString());
      } else {
        const firstAudio = streams.find((s) => s.streamType === 2);
        if (firstAudio) setSelectedAudioStream(firstAudio.id.toString());
      }
    }
    
    // Set subtitle: saved preference (only if stream still exists), or currently selected, or "0" (none)
    const validSavedSubtitle =
      savedSubtitle === "0" || (savedSubtitle && subtitleStreamIds.has(savedSubtitle))
        ? savedSubtitle
        : null;
    if (!validSavedSubtitle && savedSubtitle) {
      // Stream no longer exists — clear stale preference
      localStorage.removeItem(`subtitle_${metadata.ratingKey}`);
    }
    if (validSavedSubtitle !== null) {
      setSelectedSubtitleStream(validSavedSubtitle);
    } else {
      const currentSubtitle = streams.find((s) => s.streamType === 3 && s.selected);
      if (currentSubtitle) {
        setSelectedSubtitleStream(currentSubtitle.id.toString());
      } else {
        setSelectedSubtitleStream("0");
      }
    }
  }, [metadata?.ratingKey, metadata?.Media]);

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
  }, [metadata?.ratingKey]);

  // Fetch fanart.tv logo for TV shows
  useEffect(() => {
    if (!metadata) return;
    
    // Only fetch for shows, seasons, or episodes
    if (info.isShow || info.isSeason || info.isEpisode) {
      let isCancelled = false;
      setFanartLogo(null); // clear stale logo from previous item immediately
      
      getSeriesLogo(metadata)
        .then((logoUrl) => {
          if (!isCancelled && logoUrl) {
            setFanartLogo(logoUrl);
          }
        })
        .catch((error) => {
          console.error("[Fanart.tv] Failed to load logo:", error);
        });
      
      return () => {
        isCancelled = true;
      };
    } else {
      setFanartLogo(null);
    }
  }, [metadata?.ratingKey, info.isShow, info.isSeason, info.isEpisode]);

  useEffect(() => {
    if (!metadata) return;
    setMetadataForm({
      title: metadata.title ?? "",
      titleSort: metadata.titleSort ?? "",
      originalTitle: metadata.originalTitle ?? "",
      summary: metadata.summary ?? "",
      tagline: metadata.tagline ?? "",
      studio: metadata.studio ?? "",
      originallyAvailableAt: metadata.originallyAvailableAt ?? "",
      contentRating: metadata.contentRating ?? "",
      year: metadata.year ? String(metadata.year) : "",
      index: metadata.index !== undefined ? String(metadata.index) : "",
      parentIndex:
        metadata.parentIndex !== undefined ? String(metadata.parentIndex) : "",
      posterUrl: "",
      artUrl: "",
      thumbUrl: "",
    });
  }, [metadata]);

  useEffect(() => {
    if (!isImageEditorOpen || !metadata || !canEditCurrentMetadata) return;

    let cancelled = false;
    const unique = (values: string[]) => Array.from(new Set(values.filter(Boolean)));
    const sortByLikes = (a: { likes: string }, b: { likes: string }) =>
      parseInt(b.likes || "0", 10) - parseInt(a.likes || "0", 10);

    const loadSuggestions = async () => {
      setLoadingImageSuggestions(true);
      setImageSuggestions({ poster: [], art: [], thumb: [] });

      let target: Plex.Metadata | null = metadata;
      if (metadata.type === "season" && metadata.parentRatingKey) {
        target = await ServerApi.metadata({ id: metadata.parentRatingKey });
      } else if (metadata.type === "episode" && metadata.grandparentRatingKey) {
        target = await ServerApi.metadata({ id: metadata.grandparentRatingKey });
      }
      if (!target || cancelled) {
        setLoadingImageSuggestions(false);
        return;
      }

      let poster: string[] = [];
      let art: string[] = [];
      let thumb: string[] = [];

      if (target.type === "show") {
        const guids = (target as Plex.Metadata & { Guid?: Array<{ id: string }> }).Guid;
        let tvdbId = extractTvdbIdFromGuids(guids);
        if (!tvdbId) tvdbId = extractTvdbId(target.guid);
        if (tvdbId) {
          const artwork = await fetchTvShowArtwork(tvdbId);
          if (artwork) {
            poster = unique(
              [
                ...(artwork.tvposter ?? []),
                ...(artwork.seasonposter ?? []),
              ]
                .sort(sortByLikes)
                .map((img) => img.url),
            );
            art = unique(
              (artwork.showbackground ?? []).sort(sortByLikes).map((img) => img.url),
            );
            thumb = unique(
              [
                ...(artwork.tvthumb ?? []),
                ...(artwork.seasonthumb ?? []),
              ]
                .sort(sortByLikes)
                .map((img) => img.url),
            );
          }
        }
      } else if (target.type === "movie") {
        const guids = (target as Plex.Metadata & { Guid?: Array<{ id: string }> }).Guid;
        let tmdbId = extractTmdbIdFromGuids(guids);
        if (!tmdbId) tmdbId = extractTmdbId(target.guid);
        if (tmdbId) {
          const artwork = await fetchMovieArtwork(tmdbId);
          if (artwork) {
            poster = unique(
              (artwork.movieposter ?? []).sort(sortByLikes).map((img) => img.url),
            );
            art = unique(
              (artwork.moviebackground ?? []).sort(sortByLikes).map((img) => img.url),
            );
            thumb = unique(
              (artwork.moviethumb ?? []).sort(sortByLikes).map((img) => img.url),
            );
          }
        }
      }

      if (cancelled) return;
      setImageSuggestions({
        poster: poster.slice(0, 20),
        art: art.slice(0, 20),
        thumb: thumb.slice(0, 20),
      });
      setLoadingImageSuggestions(false);
    };

    loadSuggestions();
    return () => {
      cancelled = true;
    };
  }, [isImageEditorOpen, metadata, canEditCurrentMetadata]);

  useEffect(() => {
    if (!metadata || !canEditCurrentMetadata) return;
    const shouldOpenEditor = searchParams.get("edit") === "1";
    if (!shouldOpenEditor) return;
    if (autoEditOpenedForMidRef.current === metadata.ratingKey) return;
    autoEditOpenedForMidRef.current = metadata.ratingKey;
    setMetadataSaveError(null);
    setMetadataEditorOpen(true);
  }, [searchParams, metadata, canEditCurrentMetadata]);

  useEffect(() => {
    closeButtonRef.current?.scrollIntoView(false);
    if (mid && close) close();
  }, [mid]);

  useEffect(() => {
    if (!info.coverImage) return;
    const img = new window.Image();
    img.src = info.coverImage;
  }, [info.coverImage]);

  useEffect(() => {
    if (!metadata) return;
    if (info.isEpisode || info.isMovie) {
      if (
        metadata.Media?.length &&
        metadata.Media[0].Part?.length &&
        metadata.Media[0].Part[0].Stream?.length
      ) {
        process(metadata.Media[0].Part[0].Stream);
      }
    }
  }, [info.isEpisode, info.isMovie, metadata]);

  const handleClose = () => {
    const params = new URLSearchParams(searchParams);
    params.delete("mid");
    params.delete("iid");
    params.delete("pid");
    params.delete("edit");
    router.replace(`${pathname}?${params}`, { scroll: false });
  };

  const handleBack = () => {
    router.back();
  };

  const handlePlay = async () => {
    if (!metadata) return;

    // Apply audio/subtitle selections if available (for movies and episodes)
    if ((info.isMovie || info.isEpisode) && metadata.Media && metadata.Media.length > 0) {
      const partId = metadata.Media[0].Part[0].id.toString();
      
      // Apply audio stream selection
      if (selectedAudioStream) {
        try {
          await ServerApi.audio({
            part: partId,
            stream: selectedAudioStream,
          });
          localStorage.setItem(`audio_${metadata.ratingKey}`, selectedAudioStream);
        } catch (error) {
          console.error("Error setting audio stream:", error);
        }
      }

      // Apply subtitle stream selection
      if (selectedSubtitleStream && selectedSubtitleStream !== "0") {
        try {
          await ServerApi.subtitle({
            part: partId,
            stream: selectedSubtitleStream,
          });
          localStorage.setItem(`subtitle_${metadata.ratingKey}`, selectedSubtitleStream);
        } catch (error) {
          console.error("Error setting subtitle stream:", error);
        }
      } else if (selectedSubtitleStream === "0") {
        // Disable subtitles
        try {
          await ServerApi.subtitle({
            part: partId,
            stream: "0",
          });
          localStorage.setItem(`subtitle_${metadata.ratingKey}`, "0");
        } catch (error) {
          console.error("Error disabling subtitles:", error);
        }
      }
    }

    // For shows and seasons, find the first unwatched episode
    if (info.isShow || info.isSeason) {
      let episodeToPlay: Plex.Metadata | null = null;

      // First, try to find an episode that's in progress (has viewOffset but not fully watched)
      if (seasonChildren) {
        episodeToPlay = seasonChildren.find(
          (ep) => ep.viewOffset && ep.viewOffset > 0 && (!ep.viewCount || ep.viewCount === 0)
        ) || null;
      }

      // If no in-progress episode, find the first unwatched episode
      if (!episodeToPlay && seasonChildren) {
        episodeToPlay = seasonChildren.find(
          (ep) => !ep.viewCount || ep.viewCount === 0
        ) || null;
      }

      // If all episodes in current season are watched, try to get episodes from all seasons for shows
      if (!episodeToPlay && info.isShow && showChildren) {
        // Try each season in order to find an unwatched episode
        for (const seasonMeta of showChildren) {
          try {
            const seasonEpisodes = await ServerApi.children({ id: seasonMeta.ratingKey });
            if (seasonEpisodes) {
              // Find in-progress episode first
              const inProgress = seasonEpisodes.find(
                (ep) => ep.viewOffset && ep.viewOffset > 0 && (!ep.viewCount || ep.viewCount === 0)
              );
              if (inProgress) {
                episodeToPlay = inProgress;
                break;
              }
              // Then find unwatched
              const unwatched = seasonEpisodes.find(
                (ep) => !ep.viewCount || ep.viewCount === 0
              );
              if (unwatched) {
                episodeToPlay = unwatched;
                break;
              }
            }
          } catch (error) {
            console.error("Error fetching season episodes:", error);
          }
        }
      }

      // If still no episode found, fallback to first episode of current season or use OnDeck
      if (!episodeToPlay) {
        if (seasonChildren && seasonChildren.length > 0) {
          episodeToPlay = seasonChildren[0];
        } else if (metadata.OnDeck?.Metadata) {
          episodeToPlay = metadata.OnDeck.Metadata;
        }
      }

      if (episodeToPlay) {
        router.push(
          `/browse/${metadata.librarySectionID}?${qs.stringify({
            watch: episodeToPlay.ratingKey,
            ...(episodeToPlay.viewOffset && episodeToPlay.viewOffset > 0 ? { t: episodeToPlay.viewOffset } : {}),
          })}`,
          { scroll: false }
        );
        return;
      }
    }

    // Fallback to original logic for movies and episodes
    const next = info.playable;
    if (!next) return;
    router.push(
      `/browse/${metadata.librarySectionID}?${qs.stringify({
        watch: next.ratingKey,
        ...(next.viewOffset && next.viewOffset > 0 ? { t: next.viewOffset } : {}),
      })}`,
      { scroll: false }
    );
  };

  const handleToggleWatched = async () => {
    if (!metadata) return;

    // For shows, mark all seasons and episodes as watched/unwatched
    if (info.isShow && showChildren) {
      const isFullyWatched = metadata.viewedLeafCount === metadata.leafCount;
      
      for (const seasonMeta of showChildren) {
        try {
          const seasonEpisodes = await ServerApi.children({ id: seasonMeta.ratingKey });
          if (seasonEpisodes) {
            for (const episode of seasonEpisodes) {
              const success = await ServerApi[isFullyWatched ? "unscrobble" : "scrobble"]({
                key: episode.ratingKey,
              });
              if (!success) {
                console.error(`Failed to ${isFullyWatched ? 'unmark' : 'mark'} episode ${episode.ratingKey}`);
              }
            }
          }
        } catch (error) {
          console.error("Error toggling season episodes:", error);
        }
      }
      
      // Reload metadata to reflect changes
      router.refresh();
      return;
    }

    // For seasons, mark all episodes as watched/unwatched
    if (info.isSeason && seasonChildren) {
      const isFullyWatched = metadata.viewedLeafCount === metadata.leafCount;
      
      for (const episode of seasonChildren) {
        const success = await ServerApi[isFullyWatched ? "unscrobble" : "scrobble"]({
          key: episode.ratingKey,
        });
        if (!success) {
          console.error(`Failed to ${isFullyWatched ? 'unmark' : 'mark'} episode ${episode.ratingKey}`);
        }
      }
      
      // Reload metadata to reflect changes
      router.refresh();
      return;
    }

    // For movies and episodes, just toggle the single item
    if (info.isMovie || info.isEpisode) {
      const success = await ServerApi[info.watched ? "unscrobble" : "scrobble"]({
        key: metadata.ratingKey,
      });
      if (success) {
        router.refresh();
      }
    }
  };

  const handleSaveMetadata = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!metadata || !canEditCurrentMetadata) return;

    setSavingMetadata(true);
    setMetadataSaveError(null);

    const parsedYear = metadataForm.year.trim()
      ? Number(metadataForm.year.trim())
      : undefined;
    const parsedIndex = metadataForm.index.trim()
      ? Number(metadataForm.index.trim())
      : undefined;
    const parsedParentIndex = metadataForm.parentIndex.trim()
      ? Number(metadataForm.parentIndex.trim())
      : undefined;

    if (parsedYear !== undefined && Number.isNaN(parsedYear)) {
      setMetadataSaveError("El ano debe ser un numero valido.");
      setSavingMetadata(false);
      return;
    }
    if (parsedIndex !== undefined && Number.isNaN(parsedIndex)) {
      setMetadataSaveError("El numero de episodio/temporada debe ser valido.");
      setSavingMetadata(false);
      return;
    }
    if (parsedParentIndex !== undefined && Number.isNaN(parsedParentIndex)) {
      setMetadataSaveError("El numero de temporada debe ser valido.");
      setSavingMetadata(false);
      return;
    }
    if (
      metadataForm.originallyAvailableAt.trim() &&
      !/^\d{4}-\d{2}-\d{2}$/.test(metadataForm.originallyAvailableAt.trim())
    ) {
      setMetadataSaveError("La fecha debe estar en formato YYYY-MM-DD.");
      setSavingMetadata(false);
      return;
    }

    const saved = await ServerApi.updateMetadata({
      ratingKey: metadata.ratingKey,
      librarySectionID: metadata.librarySectionID,
      type: metadata.type,
      title: metadataForm.title.trim(),
      titleSort: metadataForm.titleSort.trim(),
      originalTitle: metadataForm.originalTitle.trim(),
      summary: metadataForm.summary.trim(),
      tagline: metadataForm.tagline.trim(),
      studio: metadataForm.studio.trim(),
      originallyAvailableAt: metadataForm.originallyAvailableAt.trim(),
      contentRating: metadataForm.contentRating.trim(),
      year: parsedYear,
      ...(metadata.type === "season" || metadata.type === "episode"
        ? { index: parsedIndex }
        : {}),
      ...(metadata.type === "episode" ? { parentIndex: parsedParentIndex } : {}),
    });

    if (!saved) {
      setSavingMetadata(false);
      setMetadataSaveError(
        "No se pudo guardar. Verifica permisos de administrador en Plex.",
      );
      return;
    }

    setSavingMetadata(false);

    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["metadata"] }),
      queryClient.invalidateQueries({ queryKey: ["related"] }),
    ]);
    router.refresh();
    setMetadataEditorOpen(false);
  };

  const handleSaveImages = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!metadata || !canEditCurrentMetadata) return;

    setSavingImages(true);
    setImageSaveError(null);

    const imageUrls = [
      metadataForm.posterUrl.trim(),
      metadataForm.artUrl.trim(),
      metadataForm.thumbUrl.trim(),
    ].filter((value) => value.length > 0);

    if (imageUrls.length === 0) {
      setImageSaveError("Agrega al menos una URL de imagen.");
      setSavingImages(false);
      return;
    }

    const hasInvalidUrl = imageUrls.some((value) => {
      try {
        const url = new URL(value);
        return !(url.protocol === "http:" || url.protocol === "https:");
      } catch {
        return true;
      }
    });

    if (hasInvalidUrl) {
      setImageSaveError("Las imagenes deben ser URLs validas (http/https).");
      setSavingImages(false);
      return;
    }

    const saved = await ServerApi.updateMetadataImages({
      ratingKey: metadata.ratingKey,
      posterUrl: metadataForm.posterUrl,
      artUrl: metadataForm.artUrl,
      thumbUrl: metadataForm.thumbUrl,
    });

    setSavingImages(false);

    if (!saved) {
      setImageSaveError("No se pudieron actualizar las imagenes.");
      return;
    }

    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["metadata"] }),
      queryClient.invalidateQueries({ queryKey: ["related"] }),
    ]);
    router.refresh();
    setImageEditorOpen(false);
  };

  const handleReanalyze = async () => {
    if (!metadata || !canEditCurrentMetadata) return;
    setReanalyzing(true);
    setReanalyzeMessage(null);

    // Determine the show ratingKey
    const showKey = info.isShow
      ? metadata.ratingKey
      : info.isSeason
        ? (metadata.parentRatingKey ?? metadata.ratingKey)
        : info.isEpisode
          ? (metadata.grandparentRatingKey ?? metadata.parentRatingKey ?? metadata.ratingKey)
          : metadata.ratingKey;

    const ok = await ServerApi.analyze({ id: showKey });
    setReanalyzing(false);
    setReanalyzeMessage(
      ok ? t("metaYaflix.reanalyzeDone") : t("metaYaflix.reanalyzeFailed")
    );
    // Clear message after 6 seconds
    setTimeout(() => setReanalyzeMessage(null), 6000);
  };

  const updateScrollArrows = () => {
    const el = episodesScrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 10);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 10);
  };

  const scrollEpisodes = (direction: "left" | "right") => {
    if (!episodesScrollRef.current) return;
    const container = episodesScrollRef.current;
    const scrollAmount = container.clientWidth * 0.8;
    container.scrollBy({
      left: direction === "left" ? -scrollAmount : scrollAmount,
      behavior: "smooth",
    });
    // Update arrows after scroll animation
    setTimeout(updateScrollArrows, 350);
  };

  // Update scroll arrows when season children load
  useEffect(() => {
    updateScrollArrows();
    const el = episodesScrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", updateScrollArrows);
    return () => el.removeEventListener("scroll", updateScrollArrows);
  }, [seasonChildren]);

  if (!mid) return null;

  return (
    <Dialog open={!!mid} onOpenChange={handleClose}>
      <DialogContent className="max-w-full max-h-[100vh] h-full w-full p-0 border-none bg-black overflow-y-auto overflow-x-hidden">
        <DialogTitle className="sr-only">
          {metadata?.title || t("metaDialog.loading")}
        </DialogTitle>
        <DialogDescription className="sr-only">
          {t("metaDialog.fullDetailsDescription")}
        </DialogDescription>

        {/* Background — direct child of scroll container so sticky works */}
        <div className="sticky top-0 h-screen w-full -mb-[100vh] z-0 pointer-events-none overflow-hidden">
          <div
            className="absolute inset-[-20px] bg-cover bg-center blur-md transition-opacity duration-700"
            style={{
              backgroundImage: metadata?.art
                ? `url(${info.coverImage})`
                : undefined,
              opacity: metadata?.art ? 0.35 : 0,
            }}
          />
          <div className="absolute inset-0 bg-black/50" />
        </div>

        {/* Navbar — sticky at very top */}
        <div className="sticky top-0 z-[45] flex justify-center items-center h-[4.5rem] w-full py-4">
          <div className="flex items-center gap-3">
            {/* Navigation Links - Glassmorphic Capsules */}
            <nav className="hidden md:flex items-center gap-3">
              <a
                className="backdrop-blur-lg bg-white/10 border border-white/20 rounded-full px-6 py-2 text-white/90 hover:text-white hover:bg-white/20 font-semibold text-sm transition-all duration-200 shadow-lg"
                href="/"
              >
                {t("libraryScreen.home")}
              </a>
              {libraries
                .filter((lib) => !disabledLibraries[lib.title])
                .map((lib) => (
                  <a
                    key={lib.key}
                    className="backdrop-blur-lg bg-white/10 border border-white/20 rounded-full px-6 py-2 text-white/90 hover:text-white hover:bg-white/20 font-semibold text-sm transition-all duration-200 shadow-lg"
                    href={`/browse/${lib.key}`}
                  >
                    {lib.title}
                  </a>
                ))}
            </nav>
            
            {/* Mobile close button (replaces dead hamburger) */}
            <a
              href="/"
              className="block md:hidden backdrop-blur-lg bg-white/10 border border-white/20 rounded-full p-2 text-white hover:bg-white/20 transition-all duration-200 shadow-lg"
              aria-label="Home"
            >
              <ArrowLeft className="w-5 h-5" />
            </a>
            
            {/* Close Button */}
            <button onClick={handleClose} className="backdrop-blur-lg bg-white/10 border border-white/20 rounded-full p-2 text-white hover:bg-white/20 hover:text-white transition-all duration-200 shadow-lg" title={t("libraryScreen.close")}>
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div
          className="relative min-h-screen w-full min-w-0 z-10 -mt-[4.5rem] transition-opacity duration-700"
          style={{ opacity: metadata ? 1 : 0 }}
        >

          {/* Hero Section */}
          <div className="relative z-10 pb-16">
            <div className="relative h-[500px] sm:h-[600px] md:h-[700px] mb-16 px-4 sm:px-8 md:px-12">
              {/* Main Art Image - Centered with rounded corners */}
              <div className="absolute top-12 sm:top-16 md:top-20 left-0 right-0 bottom-0 mx-4 sm:mx-16 md:mx-24 lg:mx-32 rounded-[40px] overflow-hidden bg-white/5">
                {info.coverImage && (
                  <img
                    src={info.coverImage}
                    alt=""
                    fetchPriority="high"
                    loading="eager"
                    decoding="async"
                    className="absolute inset-0 w-full h-full object-cover transition-opacity duration-700"
                    style={{ opacity: 0 }}
                    onLoad={(e) => { (e.currentTarget as HTMLImageElement).style.opacity = "1"; }}
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/10 to-black/40 rounded-[40px]" />
                <div className="absolute top-0 left-0 right-0 h-1/3 bg-gradient-to-b from-black/60 to-transparent rounded-t-[40px]" />
              </div>

              {/* Content Overlay */}
              <div className="absolute top-12 sm:top-16 md:top-20 left-0 right-0 bottom-0 mx-4 sm:mx-16 md:mx-24 lg:mx-32 flex items-end pb-8 sm:pb-12 md:pb-16 px-4 sm:px-8 md:px-12">
                <div className="max-w-2xl">
                  {/* Series Logo from fanart.tv */}
                  {(fanartLogo || metadata?.thumb) && (
                    <div className="mb-3 sm:mb-5 animate-in fade-in slide-in-from-bottom-3 duration-500">
                      {fanartLogo ? (
                        <img
                          src={fanartLogo}
                          alt={metadata?.title}
                          className="max-w-xs sm:max-w-md md:max-w-lg max-h-28 sm:max-h-32 md:max-h-36 object-contain drop-shadow-[0_4px_20px_rgba(0,0,0,0.8)] transition-opacity duration-500"
                          style={{ opacity: 0 }}
                          onLoad={(e) => { (e.currentTarget as HTMLImageElement).style.opacity = "1"; }}
                        />
                      ) : (
                        <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white drop-shadow-[0_4px_20px_rgba(0,0,0,0.8)]">
                          {metadata?.title}
                        </h1>
                      )}
                    </div>
                  )}

                  {/* Metadata badges */}
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-sm sm:text-base mb-3 sm:mb-4 animate-in fade-in slide-in-from-bottom-2 duration-500 delay-100">
                    {info.isEpisode && metadata?.parentIndex && (
                      <span className="font-bold text-white">
                        T{metadata.parentIndex}
                      </span>
                    )}
                    {info.isEpisode && metadata?.index && (
                      <>
                        <span className="text-white/30">·</span>
                        <span className="font-bold text-white">E{metadata.index}</span>
                      </>
                    )}
                    {metadata?.year && (
                      <>
                        {(info.isEpisode) && <span className="text-white/30">·</span>}
                        <span className="font-semibold text-white">{metadata.year}</span>
                      </>
                    )}
                    {metadata?.duration && (
                      <>
                        <span className="text-white/30">·</span>
                        <span className="font-semibold text-white">{Math.round(metadata.duration / 60000)}m</span>
                      </>
                    )}
                    {metadata?.contentRating && (
                      <span className="glass-pill rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white/65">
                        {metadata.contentRating}
                      </span>
                    )}
                  </div>

                  {/* Genres */}
                  {metadata?.Genre && metadata.Genre.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-4 sm:mb-6 animate-in fade-in slide-in-from-bottom-2 duration-500 delay-150">
                      {metadata.Genre.map((genre) => (
                        <span
                          key={genre.id}
                          className="px-2.5 sm:px-3 py-0.5 sm:py-1 bg-white/10 rounded-full text-xs sm:text-sm text-white/90 font-medium"
                        >
                          {genre.tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Audio and Subtitle Selectors */}
                  {(info.isMovie || info.isEpisode) && (audioOptions.length > 0 || subtitleOptions.length > 0) && (
                    <div className="flex flex-wrap gap-3 sm:gap-4 mb-4 sm:mb-6">
                      {/* Audio Selector */}
                      {audioOptions.length > 0 && (
                        <div className="flex flex-col gap-1.5">
                          <label className="text-white/70 text-xs sm:text-sm font-medium">
                            {t("metaYaflix.audioLabel")}
                          </label>
                          <Select
                            value={selectedAudioStream || undefined}
                            onValueChange={(value) => {
                              setSelectedAudioStream(value);
                            }}
                          >
                            <SelectTrigger className="w-[180px] sm:w-[220px] glass-dark border-white/20 text-white">
                              <SelectValue placeholder={t("watch.selectAudio")} />
                            </SelectTrigger>
                            <SelectContent className="bg-black/95 border-white/20">
                              {audioOptions.map((option) => (
                                <SelectItem
                                  key={option.id}
                                  value={option.id.toString()}
                                  className="text-white hover:bg-white/10"
                                >
                                  {option.extendedDisplayTitle || option.displayTitle || option.language || `Audio ${option.id}`}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      {/* Subtitle Selector */}
                      {subtitleOptions.length > 0 && (
                        <div className="flex flex-col gap-1.5">
                          <label className="text-white/70 text-xs sm:text-sm font-medium">
                            {t("metaYaflix.subtitlesLabel")}
                          </label>
                          <Select
                            value={selectedSubtitleStream || "0"}
                            onValueChange={(value) => {
                              setSelectedSubtitleStream(value);
                            }}
                          >
                            <SelectTrigger className="w-[180px] sm:w-[220px] glass-dark border-white/20 text-white">
                              <SelectValue
                                placeholder={t("metaYaflix.selectSubtitlesPlaceholder")}
                              />
                            </SelectTrigger>
                            <SelectContent className="bg-black/95 border-white/20">
                              <SelectItem value="0" className="text-white hover:bg-white/10">
                                {t("metaYaflix.noSubtitles")}
                              </SelectItem>
                              {subtitleOptions.map((option) => (
                                <SelectItem
                                  key={option.id}
                                  value={option.id.toString()}
                                  className="text-white hover:bg-white/10"
                                >
                                  {option.extendedDisplayTitle || option.displayTitle || option.language || `Subtítulo ${option.id}`}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Play Button */}
                  <div className="flex flex-wrap gap-3 sm:gap-4 items-center animate-in fade-in slide-in-from-bottom-2 duration-500 delay-200">
                    <Button
                      onClick={handlePlay}
                      variant="default"
                      className="gap-2 sm:gap-2.5 text-base sm:text-lg py-2.5 sm:py-3.5 px-6 sm:px-8 bg-white text-black hover:bg-white/90 transition-all duration-200 font-bold rounded-md shadow-lg"
                    >
                      <Play className="w-5 h-5 sm:w-6 sm:h-6" fill="currentColor" />
                      <span>{t("metaYaflix.play")}</span>
                    </Button>
                    {(nextEpisodeInfo
                      ? (nextEpisodeInfo.season != null && nextEpisodeInfo.episode != null)
                      : (info.playable?.season != null && info.playable?.episode != null)
                    ) && (
                      <span className="text-white/70 text-xs sm:text-sm font-medium">
                        {nextEpisodeInfo
                          ? `T${nextEpisodeInfo.season} E${nextEpisodeInfo.episode}`
                          : `T${info.playable!.season} E${info.playable!.episode}`}
                      </span>
                    )}
                    <Button
                      onClick={handleToggleWatched}
                      className="w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center transition-colors border bg-plex hover:bg-plex/80 border-plex"
                      title={
                        info.watched
                          ? t("metaYaflix.markAsUnwatched")
                          : t("metaYaflix.markAsWatched")
                      }
                    >
                      {info.watched ? (
                        <Check className="w-4 h-4 sm:w-5 sm:h-5 text-white" strokeWidth={2.5} />
                      ) : (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="24"
                          height="24"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="w-4 h-4 sm:w-5 sm:h-5 text-white"
                        >
                          <path d="M20 6 9 17l-5-5" opacity="0.3"></path>
                        </svg>
                      )}
                    </Button>
                    {canEditCurrentMetadata && (
                      <Button
                        variant="outline"
                        onClick={() => {
                          setMetadataSaveError(null);
                          setMetadataEditorOpen(true);
                        }}
                        className="text-white border-white/40 bg-black/30 hover:bg-white/15 hover:text-white"
                      >
                        {t("metaYaflix.editMetadata")}
                      </Button>
                    )}
                    {canEditCurrentMetadata && (info.isShow || info.isSeason || info.isEpisode) && (
                      <Button
                        variant="outline"
                        onClick={handleReanalyze}
                        disabled={reanalyzing}
                        className="text-white border-white/40 bg-black/30 hover:bg-white/15 hover:text-white"
                      >
                        {reanalyzing ? t("metaYaflix.reanalyzing") : t("metaYaflix.reanalyzeEpisodes")}
                      </Button>
                    )}
                    {reanalyzeMessage && (
                      <span className="text-sm text-white/70">{reanalyzeMessage}</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Tabs - Sticky */}
            <div className="mb-6 sm:mb-8">
              <div className="px-4 sm:px-8 md:px-16 lg:px-32 flex gap-4 sm:gap-8 items-center overflow-x-auto no-scrollbar border-b border-white/10">
                <button
                  onClick={() => setActiveTab("general")}
                  className={cn(
                    "px-3 sm:px-6 py-3 sm:py-4 text-sm sm:text-base font-semibold relative whitespace-nowrap transition-colors duration-200",
                    activeTab === "general" ? "text-white" : "text-white/50 hover:text-white/80"
                  )}
                >
                  {t("metaYaflix.general")}
                  <div
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-plex transition-transform duration-300 ease-out origin-left"
                    style={{ transform: activeTab === "general" ? "scaleX(1)" : "scaleX(0)" }}
                  />
                </button>
                {!info.isEpisode && (
                  <button
                    onClick={() => setActiveTab("episodes")}
                    className={cn(
                      "px-3 sm:px-6 py-3 sm:py-4 text-sm sm:text-base font-semibold relative whitespace-nowrap transition-colors duration-200",
                      activeTab === "episodes" ? "text-white" : "text-white/50 hover:text-white/80"
                    )}
                  >
                    {t("metaYaflix.allEpisodes")}
                    <div
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-plex transition-transform duration-300 ease-out origin-left"
                      style={{ transform: activeTab === "episodes" ? "scaleX(1)" : "scaleX(0)" }}
                    />
                  </button>
                )}
                {info.isEpisode && metadata?.grandparentRatingKey && (
                  <button
                    onClick={() => {
                      router.push(`${pathname}?mid=${metadata.grandparentRatingKey}`, {
                        scroll: false,
                      });
                    }}
                    className="px-3 sm:px-6 py-3 sm:py-4 text-sm sm:text-base font-semibold relative whitespace-nowrap transition-colors duration-200 text-white/50 hover:text-white/80"
                  >
                    {t("metaYaflix.moreEpisodes")}
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/20" style={{ transform: "scaleX(0)" }} />
                  </button>
                )}
              </div>
            </div>

            {/* Content Sections */}
            <div className="px-4 sm:px-8 md:px-16 lg:px-32 min-w-0">
              <div key={`${mid}-${activeTab}`} className="animate-in fade-in slide-in-from-bottom-2 duration-300">
              {/* General tab */}
              {activeTab === "general" && (
              <div className="space-y-8 sm:space-y-10">
                  <div className="rounded-xl sm:rounded-2xl p-4 sm:p-6 backdrop-blur-lg bg-white/10 border border-white/20 shadow-xl">
                    <h2 className="text-xl sm:text-2xl font-bold text-white mb-3 sm:mb-4">
                      {t("metaYaflix.synopsis")}
                    </h2>
                    <p className="text-white/80 leading-relaxed text-base sm:text-lg max-w-4xl">
                      {metadata?.summary || t("metaYaflix.noDescription")}
                    </p>
                  </div>

                  {/* Cast */}
                  {metadata?.Role && metadata.Role.length > 0 && (
                    <div>
                      <h2 className="text-xl sm:text-2xl font-bold text-white mb-4 sm:mb-6">
                        {t("metaYaflix.cast")}
                      </h2>
                      <div className="flex gap-3 sm:gap-4 pb-4 overflow-x-auto no-scrollbar">
                        {metadata.Role.slice(0, 10).map((role) => (
                          <div key={role.id} className="flex-shrink-0 text-center" style={{ width: '120px' }}>
                            <div className="w-28 h-28 sm:w-28 sm:h-28 md:w-28 md:h-28 mx-auto rounded-full bg-white/10 overflow-hidden mb-2 ring-2 ring-white/10">
                              {role.thumb ? (
                                <img
                                  src={plexImage(role.thumb, 200, 200)}
                                  alt={role.tag}
                                  className="w-full h-full object-cover"
                                  loading="lazy"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = 'none';
                                  }}
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-white/30 text-2xl font-bold">
                                  {role.tag?.[0] || '?'}
                                </div>
                              )}
                            </div>
                            <p className="text-xs sm:text-sm text-white font-semibold truncate px-1">
                              {role.tag}
                            </p>
                            <p className="text-[10px] sm:text-xs text-white/60 truncate mt-0.5 sm:mt-1 px-1">
                              {role.role}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Seasons Selector */}
                  {info.isShow && showChildren && showChildren.length > 0 && (
                    <div className="w-full min-w-0">
                      <div className="flex gap-2 sm:gap-3 mb-4 sm:mb-6 overflow-x-auto pb-2 no-scrollbar">
                        {showChildren.map((s) => (
                          <button
                            key={s.ratingKey}
                            onClick={() => setSelectedSeason(s.ratingKey)}
                            className={cn(
                              "px-4 sm:px-6 py-2 sm:py-3 rounded-lg whitespace-nowrap border font-semibold text-sm sm:text-base flex-shrink-0",
                              "transition-[background-color,color,box-shadow,border-color] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
                              selectedSeason === s.ratingKey || (!selectedSeason && s.ratingKey === showChildren[0].ratingKey)
                                ? "bg-plex text-white border-plex shadow-lg shadow-plex/30"
                                : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white border-white/10"
                            )}
                          >
                            {localizeSeasonTitle(s.title)}
                          </button>
                        ))}
                      </div>

                      {/* Episodes Horizontal Scroll */}
                      <div className="relative group/episodes overflow-hidden">
                        {canScrollLeft && (
                          <button
                            onClick={() => scrollEpisodes("left")}
                            className="absolute left-2 top-[40%] -translate-y-1/2 z-20 w-10 h-10 sm:w-12 sm:h-12 bg-black/90 hover:bg-plex rounded-full flex items-center justify-center transition-all duration-300 backdrop-blur-sm border-2 border-white/30 shadow-lg"
                          >
                            <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6 text-white" strokeWidth={2.5} />
                          </button>
                        )}

                        {canScrollRight && (
                          <button
                            onClick={() => scrollEpisodes("right")}
                            className="absolute right-2 top-[40%] -translate-y-1/2 z-20 w-10 h-10 sm:w-12 sm:h-12 bg-black/90 hover:bg-plex rounded-full flex items-center justify-center transition-all duration-300 backdrop-blur-sm border-2 border-white/30 shadow-lg"
                          >
                            <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6 text-white" strokeWidth={2.5} />
                          </button>
                        )}

                        <div
                          id="episodes-scroll"
                          ref={episodesScrollRef}
                          className="overflow-x-auto overflow-y-hidden no-scrollbar scroll-smooth"
                        >
                          <div className="flex gap-4 pb-4">
                            {seasonChildren?.map((episode) => (
                                <div
                                  key={episode.ratingKey}
                                  className="w-[220px] sm:w-[250px] md:w-[280px] lg:w-[300px] flex-shrink-0 flex-grow-0"
                                >
                                  <div className="relative rounded-xl overflow-hidden bg-white/5 transition-all duration-200">
                                    <a
                                      href={`/browse/${metadata?.librarySectionID}?${qs.stringify({
                                        watch: episode.ratingKey,
                                      })}`}
                                      className="group block"
                                    >
                                      <div className="relative w-full aspect-video bg-white/10 overflow-hidden">
                                        <img
                                          src={plexImage(episode.thumb)}
                                          alt={episode.title}
                                          className="w-full h-full object-cover opacity-60"
                                        />

                                        {episode.viewCount && episode.viewCount > 0 && (
                                          <div className="absolute top-2 right-2 w-8 h-8 rounded-full flex items-center justify-center shadow-lg z-20 bg-plex">
                                            <Check className="w-4 h-4 text-white" strokeWidth={3} />
                                          </div>
                                        )}

                                        {episode.index === 1 && (
                                          <div className="absolute top-2 left-2 px-2 py-1 rounded bg-plex text-white text-xs font-bold">
                                            {t("metaYaflix.next")}
                                          </div>
                                        )}

                                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30">
                                          <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center">
                                            <Play className="w-6 h-6 text-black ml-0.5" fill="currentColor" />
                                          </div>
                                        </div>
                                      </div>
                                    </a>

                                    <a
                                      href={`${pathname}?mid=${episode.ratingKey}`}
                                      className="block hover:bg-white/10 transition-all duration-200"
                                    >
                                      <div className="p-4">
                                        <div className="flex items-center gap-2 mb-1">
                                          <p className="text-plex text-sm font-semibold">
                                            {t("metaYaflix.episode")} {episode.index}
                                          </p>
                                          {episode.viewCount && episode.viewCount > 0 && (
                                            <span className="text-white/40 text-xs">
                                              • {t("metaYaflix.watched")}
                                            </span>
                                          )}
                                        </div>
                                        <h3 className="text-white font-bold text-lg mb-2 line-clamp-1">
                                          {episode.title}
                                        </h3>
                                        <p className="text-white/60 text-sm line-clamp-2 mb-2">
                                          {episode.summary}
                                        </p>
                                        <p className="text-white/50 text-xs font-medium">
                                          {episode.duration ? `${Math.round(episode.duration / 60000)}m` : ""}
                                        </p>
                                      </div>
                                    </a>
                                  </div>
                                </div>
                              ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
              </div>
              )}

              {/* All Episodes Tab */}
              {info.isShow && activeTab === "episodes" && (
              <div className="space-y-6">
                <div>
                  {/* Season selector */}
                  {showChildren && showChildren.length > 0 && (
                    <div className="flex gap-2 sm:gap-3 mb-6 overflow-x-auto pb-2 no-scrollbar -mx-1 px-1">
                      {showChildren.map((s) => (
                        <button
                          key={s.ratingKey}
                          onClick={() => setSelectedSeason(s.ratingKey)}
                          className={cn(
                            "px-4 sm:px-6 py-2 sm:py-3 rounded-lg whitespace-nowrap border font-semibold text-sm sm:text-base flex-shrink-0",
                            "transition-[background-color,color,box-shadow,border-color] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
                            selectedSeason === s.ratingKey || (!selectedSeason && s.ratingKey === showChildren[0].ratingKey)
                              ? "bg-plex text-white border-plex shadow-lg shadow-plex/30"
                              : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white border-white/10"
                          )}
                        >
                          {localizeSeasonTitle(s.title)}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Episodes list - vertical */}
                  <div className="space-y-4">
                    {seasonChildren?.map((episode) => (
                        <div
                          key={episode.ratingKey}
                          className="flex rounded-xl bg-white/5 transition-all duration-200 overflow-hidden border border-white/5"
                        >
                          <a
                            href={`/browse/${metadata?.librarySectionID}?${qs.stringify({ watch: episode.ratingKey })}`}
                            className="group flex-shrink-0"
                          >
                            <div className="relative w-48 sm:w-56 aspect-video bg-white/10 overflow-hidden h-full">
                              <img
                                src={plexImage(episode.thumb)}
                                alt={episode.title}
                                className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity"
                              />
                              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30">
                                <div className="w-10 h-10 rounded-full bg-white/90 flex items-center justify-center">
                                  <Play className="w-5 h-5 text-black ml-0.5" fill="currentColor" />
                                </div>
                              </div>
                              {episode.viewCount && episode.viewCount > 0 && (
                                <div className="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center bg-plex">
                                  <Check className="w-3 h-3 text-white" strokeWidth={3} />
                                </div>
                              )}
                            </div>
                          </a>
                          <a
                            href={`${pathname}?mid=${episode.ratingKey}`}
                            className="flex-1 py-3 px-4 hover:bg-white/10 transition-all duration-200"
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-plex text-sm font-semibold">
                                {t("metaYaflix.episode")} {episode.index}
                              </span>
                              {episode.duration && (
                                <span className="text-white/40 text-xs">
                                  {Math.round(episode.duration / 60000)}m
                                </span>
                              )}
                              {episode.viewCount && episode.viewCount > 0 && (
                                <span className="text-white/40 text-xs">
                                  • {t("metaYaflix.watched")}
                                </span>
                              )}
                            </div>
                            <h3 className="text-white font-bold text-base mb-1 line-clamp-1">
                              {episode.title}
                            </h3>
                            <p className="text-white/50 text-sm line-clamp-2">
                              {episode.summary}
                            </p>
                          </a>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
              )}

              </div>{/* end key={activeTab} */}

              {/* Related Content */}
              {relatedItems && relatedItems.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-4 sm:mb-5 px-1">
                    <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                      {t("metaYaflix.youMayAlsoLike")}
                    </h2>
                  </div>
                  <div className="relative group/carousel-scroll overflow-visible">
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4 py-4 px-1">
                      {relatedItems.map((item, i) => (
                        <a
                          key={item.ratingKey || i}
                          href={`/browse/${metadata?.librarySectionID}?${qs.stringify({ mid: item.ratingKey })}`}
                        >
                          <div className="relative group cursor-pointer w-full">
                            <div className="relative rounded-lg overflow-hidden w-full h-60 sm:h-72 md:h-80 bg-white/5 shadow-2xl group-hover:shadow-plex/20">
                              <img
                                src={plexImage(item.thumb)}
                                alt={item.title}
                                className="w-full h-full object-cover"
                                loading="lazy"
                              />
                              {item.viewCount && item.viewCount > 0 && (
                                <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-plex shadow-lg" />
                              )}
                            </div>
                            <div className="mt-2 space-y-0.5">
                              <p className="text-sm text-white font-medium truncate">
                                {item.title}
                              </p>
                              <div className="flex items-center gap-2 text-xs text-white/50">
                                {item.year && <span>{item.year}</span>}
                              </div>
                            </div>
                          </div>
                        </a>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
      <MetadataEditorDialog
        ratingKey={isMetadataEditorOpen && metadata ? metadata.ratingKey : null}
        onClose={() => setMetadataEditorOpen(false)}
      />
    </Dialog>
  );
};

const SuggestionStrip: FC<{
  title: string;
  items: string[];
  onSelect: (value: string) => void;
}> = ({ title, items, onSelect }) => {
  if (!items.length) return null;

  return (
    <div className="space-y-2">
      <p className="text-xs text-white/70">{title}</p>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {items.map((url) => (
          <button
            key={url}
            type="button"
            onClick={() => onSelect(url)}
            className="shrink-0 rounded border border-white/20 overflow-hidden hover:border-plex transition-colors"
            title="Usar imagen"
          >
            <img
              src={url}
              alt={title}
              className="w-24 h-14 object-cover bg-black/40"
              loading="lazy"
            />
          </button>
        ))}
      </div>
    </div>
  );
};



