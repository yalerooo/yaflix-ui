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
import { Skeleton } from "@/components/ui/skeleton";
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
    
    // Set audio: saved preference, or currently selected, or first audio stream
    if (savedAudio) {
      setSelectedAudioStream(savedAudio);
    } else {
      const currentAudio = streams.find((s) => s.streamType === 2 && s.selected);
      if (currentAudio) {
        setSelectedAudioStream(currentAudio.id.toString());
      } else {
        const firstAudio = streams.find((s) => s.streamType === 2);
        if (firstAudio) setSelectedAudioStream(firstAudio.id.toString());
      }
    }
    
    // Set subtitle: saved preference, or currently selected, or "0" (none)
    if (savedSubtitle) {
      setSelectedSubtitleStream(savedSubtitle);
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
          {metadata?.title || "Loading..."}
        </DialogTitle>
        <DialogDescription className="sr-only">
          Detalles completos de la serie o película seleccionada
        </DialogDescription>

        {/* Background — direct child of scroll container so sticky works */}
        <div className="sticky top-0 h-screen w-full -mb-[100vh] z-0 pointer-events-none overflow-hidden">
          <div
            className="absolute inset-[-20px] bg-cover bg-center blur-md opacity-35"
            style={{
              backgroundImage: metadata?.art
                ? `url(${info.coverImage})`
                : undefined,
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
                Home
              </a>
              <a
                className="backdrop-blur-lg bg-white/10 border border-white/20 rounded-full px-6 py-2 text-white/90 hover:text-white hover:bg-white/20 font-semibold text-sm transition-all duration-200 shadow-lg"
                href="/browse/2"
              >
                Películas
              </a>
              <a
                className="backdrop-blur-lg bg-white/10 border border-white/20 rounded-full px-6 py-2 text-white/90 hover:text-white hover:bg-white/20 font-semibold text-sm transition-all duration-200 shadow-lg"
                href="/browse/1"
              >
                Anime
              </a>
            </nav>
            
            {/* Mobile Menu Button */}
            <button className="block md:hidden backdrop-blur-lg bg-white/10 border border-white/20 rounded-full p-2 text-white hover:bg-white/20 transition-all duration-200 shadow-lg">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="4" x2="20" y1="12" y2="12"></line>
                <line x1="4" x2="20" y1="6" y2="6"></line>
                <line x1="4" x2="20" y1="18" y2="18"></line>
              </svg>
            </button>
            
            {/* Close Button */}
            <button onClick={handleClose} className="backdrop-blur-lg bg-white/10 border border-white/20 rounded-full p-2 text-white hover:bg-white/20 hover:text-white transition-all duration-200 shadow-lg" title="Cerrar">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div
          className="relative min-h-screen w-full min-w-0 z-10 -mt-[4.5rem]"
          style={{ overflowX: 'clip' }}
        >

          {/* Hero Section */}
          <div className="relative z-10 pb-16">
            <div className="relative h-[500px] sm:h-[600px] md:h-[700px] mb-16 px-4 sm:px-8 md:px-12">
              {/* Main Art Image - Centered with rounded corners */}
              <div
                className="absolute top-12 sm:top-16 md:top-20 left-0 right-0 bottom-0 mx-4 sm:mx-16 md:mx-24 lg:mx-32 bg-cover bg-center rounded-[40px]"
                style={{
                  backgroundImage: metadata?.art
                    ? `url(${info.coverImage})`
                    : undefined,
                }}
              >
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/10 to-black/40 rounded-[40px]" />
                <div className="absolute top-0 left-0 right-0 h-1/3 bg-gradient-to-b from-black/60 to-transparent rounded-t-[40px]" />
              </div>

              {/* Content Overlay */}
              <div className="absolute top-12 sm:top-16 md:top-20 left-0 right-0 bottom-0 mx-4 sm:mx-16 md:mx-24 lg:mx-32 flex items-end pb-8 sm:pb-12 md:pb-16 px-4 sm:px-8 md:px-12">
                <div className="max-w-2xl">
                  {/* Series Logo from fanart.tv */}
                  {(fanartLogo || metadata?.thumb) && (
                    <div className="mb-3 sm:mb-5">
                      {fanartLogo ? (
                        <img
                          src={fanartLogo}
                          alt={metadata?.title}
                          className="max-w-xs sm:max-w-md md:max-w-lg max-h-28 sm:max-h-32 md:max-h-36 object-contain drop-shadow-[0_4px_20px_rgba(0,0,0,0.8)]"
                        />
                      ) : (
                        <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white drop-shadow-[0_4px_20px_rgba(0,0,0,0.8)]">
                          {metadata?.title}
                        </h1>
                      )}
                    </div>
                  )}

                  {/* Metadata badges */}
                  <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-white/90 text-sm sm:text-base mb-3 sm:mb-4">
                    {info.isEpisode && metadata?.parentIndex && (
                      <span className="font-semibold">
                        Temporada {metadata.parentIndex}
                      </span>
                    )}
                    {info.isEpisode && metadata?.index && (
                      <span className="font-semibold">
                        Episodio {metadata.index}
                      </span>
                    )}
                    {metadata?.year && (
                      <span className="font-medium">{metadata.year}</span>
                    )}
                    {metadata?.contentRating && (
                      <span className="px-2 py-0.5 border border-white/50 rounded text-sm font-medium">
                        {metadata.contentRating}
                      </span>
                    )}
                    {metadata?.duration && (
                      <span className="font-medium">
                        {Math.round(metadata.duration / 60000)}m
                      </span>
                    )}
                  </div>

                  {/* Genres */}
                  {metadata?.Genre && metadata.Genre.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-4 sm:mb-6">
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
                            Audio
                          </label>
                          <Select
                            value={selectedAudioStream || undefined}
                            onValueChange={(value) => {
                              setSelectedAudioStream(value);
                            }}
                          >
                            <SelectTrigger className="w-[180px] sm:w-[220px] glass-dark border-white/20 text-white">
                              <SelectValue placeholder="Seleccionar audio" />
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
                            Subtítulos
                          </label>
                          <Select
                            value={selectedSubtitleStream || "0"}
                            onValueChange={(value) => {
                              setSelectedSubtitleStream(value);
                            }}
                          >
                            <SelectTrigger className="w-[180px] sm:w-[220px] glass-dark border-white/20 text-white">
                              <SelectValue placeholder="Seleccionar subtítulos" />
                            </SelectTrigger>
                            <SelectContent className="bg-black/95 border-white/20">
                              <SelectItem value="0" className="text-white hover:bg-white/10">
                                Sin subtítulos
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
                  <div className="flex flex-wrap gap-3 sm:gap-4 items-center">
                    <Button
                      onClick={handlePlay}
                      variant="default"
                      className="gap-2 sm:gap-2.5 text-base sm:text-lg py-2.5 sm:py-3.5 px-6 sm:px-8 bg-white text-black hover:bg-white/90 transition-all duration-200 font-bold rounded-md shadow-lg"
                    >
                      <Play className="w-5 h-5 sm:w-6 sm:h-6" fill="currentColor" />
                      <span>Reproducir</span>
                    </Button>
                    {(nextEpisodeInfo || info.playable) && (
                      <span className="text-white/70 text-xs sm:text-sm font-medium">
                        {nextEpisodeInfo
                          ? `T${nextEpisodeInfo.season} E${nextEpisodeInfo.episode}`
                          : `T${info.playable!.season} E${info.playable!.episode}`}
                      </span>
                    )}
                    <Button
                      onClick={handleToggleWatched}
                      className="w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center transition-colors border bg-plex hover:bg-plex/80 border-plex"
                      title={info.watched ? "Marcar como no visto" : "Marcar como visto"}
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
                        Editar metadatos
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Tabs - Sticky */}
            <div className="sticky top-0 z-30 mb-6 sm:mb-8">
              <div className="px-4 sm:px-8 md:px-16 lg:px-32 flex gap-4 sm:gap-8 items-center">
                <button
                  onClick={() => setActiveTab("general")}
                  className={cn(
                    "px-3 sm:px-6 py-3 sm:py-4 text-sm sm:text-base font-semibold transition-all relative whitespace-nowrap",
                    activeTab === "general" ? "text-white" : "text-white/80 hover:text-white"
                  )}
                >
                  General
                  {activeTab === "general" && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-plex" />
                  )}
                </button>
                {!info.isEpisode && (
                  <button
                    onClick={() => setActiveTab("episodes")}
                    className={cn(
                      "px-3 sm:px-6 py-3 sm:py-4 text-sm sm:text-base font-semibold transition-all relative whitespace-nowrap",
                      activeTab === "episodes" ? "text-white" : "text-white/80 hover:text-white"
                    )}
                  >
                    Todos los episodios
                    {activeTab === "episodes" && (
                      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-plex" />
                    )}
                  </button>
                )}
                {info.isEpisode && metadata?.grandparentRatingKey && (
                  <button
                    onClick={() => {
                      router.push(`${pathname}?mid=${metadata.grandparentRatingKey}`, {
                        scroll: false,
                      });
                    }}
                    className="glass-pill rounded-full px-4 py-2 text-sm font-semibold text-white/90 hover:text-white hover:bg-white/15 transition-all duration-200"
                  >
                    Más episodios
                  </button>
                )}
              </div>
            </div>

            {/* Content Sections */}
            <div className="px-4 sm:px-8 md:px-16 lg:px-32 space-y-8 sm:space-y-10 min-w-0">
              {/* Synopsis */}
              {activeTab === "general" && (
                <>
                  <div className="rounded-xl sm:rounded-2xl p-4 sm:p-6 backdrop-blur-lg bg-white/10 border border-white/20 shadow-xl">
                    <h2 className="text-xl sm:text-2xl font-bold text-white mb-3 sm:mb-4">Sinopsis</h2>
                    <p className="text-white/80 leading-relaxed text-base sm:text-lg max-w-4xl">
                      {metadata?.summary || "No description available."}
                    </p>
                  </div>

                  {/* Cast */}
                  {metadata?.Role && metadata.Role.length > 0 && (
                    <div>
                      <h2 className="text-xl sm:text-2xl font-bold text-white mb-4 sm:mb-6">Reparto</h2>
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
                              "px-4 sm:px-6 py-2 sm:py-3 rounded-lg whitespace-nowrap transition-all font-semibold text-sm sm:text-base flex-shrink-0",
                              selectedSeason === s.ratingKey || (!selectedSeason && s.ratingKey === showChildren[0].ratingKey)
                                ? "bg-plex text-white shadow-lg shadow-plex/30"
                                : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white border border-white/10"
                            )}
                          >
                            {s.title}
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
                            {loadingSeasonChildren ? (
                              Array.from({ length: 5 }).map((_, i) => (
                                <div key={i} className="w-[220px] sm:w-[250px] md:w-[280px] lg:w-[300px] flex-shrink-0 flex-grow-0">
                                  <Skeleton className="w-full aspect-video rounded-xl mb-4" />
                                  <Skeleton className="h-6 w-3/4 mb-2" />
                                  <Skeleton className="h-4 w-full" />
                                </div>
                              ))
                            ) : (
                              seasonChildren?.map((episode) => (
                                <a
                                  key={episode.ratingKey}
                                  href={`/browse/${metadata?.librarySectionID}?${qs.stringify({
                                    watch: episode.ratingKey,
                                  })}`}
                                  className="group w-[220px] sm:w-[250px] md:w-[280px] lg:w-[300px] flex-shrink-0 flex-grow-0"
                                >
                                  <div className="relative rounded-xl overflow-hidden bg-white/5 hover:bg-white/10 transition-all duration-200">
                                    <div className="relative w-full aspect-video bg-white/10 overflow-hidden">
                                      <img
                                        src={plexImage(episode.thumb)}
                                        alt={episode.title}
                                        className="w-full h-full object-cover opacity-60"
                                      />
                                      
                                      {episode.viewCount && episode.viewCount > 0 && (
                                        <button className="absolute top-2 right-2 w-8 h-8 rounded-full flex items-center justify-center shadow-lg transition-all duration-200 z-20 bg-plex hover:bg-plex/80">
                                          <Check className="w-4 h-4 text-white" strokeWidth={3} />
                                        </button>
                                      )}

                                      {episode.index === 1 && (
                                        <div className="absolute top-2 left-2 px-2 py-1 rounded bg-plex text-white text-xs font-bold">
                                          Siguiente
                                        </div>
                                      )}

                                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30">
                                        <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center">
                                          <Play className="w-6 h-6 text-black ml-0.5" fill="currentColor" />
                                        </div>
                                      </div>
                                    </div>

                                    <div className="p-4">
                                      <div className="flex items-center gap-2 mb-1">
                                        <p className="text-plex text-sm font-semibold">
                                          Episodio {episode.index}
                                        </p>
                                        {episode.viewCount && episode.viewCount > 0 && (
                                          <span className="text-white/40 text-xs">• Visto</span>
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
                                  </div>
                                </a>
                              ))
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* All Episodes Tab */}
              {activeTab === "episodes" && info.isShow && (
                <div>
                  {/* Season selector */}
                  {showChildren && showChildren.length > 0 && (
                    <div className="flex gap-2 sm:gap-3 mb-6 overflow-x-auto pb-2 no-scrollbar -mx-1 px-1">
                      {showChildren.map((s) => (
                        <button
                          key={s.ratingKey}
                          onClick={() => setSelectedSeason(s.ratingKey)}
                          className={cn(
                            "px-4 sm:px-6 py-2 sm:py-3 rounded-lg whitespace-nowrap transition-all font-semibold text-sm sm:text-base flex-shrink-0",
                            selectedSeason === s.ratingKey || (!selectedSeason && s.ratingKey === showChildren[0].ratingKey)
                              ? "bg-plex text-white shadow-lg shadow-plex/30"
                              : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white border border-white/10"
                          )}
                        >
                          {s.title}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Episodes list - vertical */}
                  <div className="space-y-4">
                    {loadingSeasonChildren ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="flex gap-4 animate-pulse">
                          <Skeleton className="w-48 aspect-video rounded-lg flex-shrink-0" />
                          <div className="flex-1 space-y-2 py-2">
                            <Skeleton className="h-5 w-1/3" />
                            <Skeleton className="h-4 w-full" />
                            <Skeleton className="h-4 w-2/3" />
                          </div>
                        </div>
                      ))
                    ) : (
                      seasonChildren?.map((episode) => (
                        <a
                          key={episode.ratingKey}
                          href={`/browse/${metadata?.librarySectionID}?${qs.stringify({ watch: episode.ratingKey })}`}
                          className="flex gap-4 group rounded-xl bg-white/5 hover:bg-white/10 transition-all duration-200 overflow-hidden border border-white/5 hover:border-white/10"
                        >
                          <div className="relative w-48 sm:w-56 flex-shrink-0 aspect-video bg-white/10 overflow-hidden">
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
                          <div className="flex-1 py-3 pr-4">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-plex text-sm font-semibold">
                                Episodio {episode.index}
                              </span>
                              {episode.duration && (
                                <span className="text-white/40 text-xs">
                                  {Math.round(episode.duration / 60000)}m
                                </span>
                              )}
                              {episode.viewCount && episode.viewCount > 0 && (
                                <span className="text-white/40 text-xs">• Visto</span>
                              )}
                            </div>
                            <h3 className="text-white font-bold text-base mb-1 line-clamp-1">
                              {episode.title}
                            </h3>
                            <p className="text-white/50 text-sm line-clamp-2">
                              {episode.summary}
                            </p>
                          </div>
                        </a>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* Related Content */}
              {relatedItems && relatedItems.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-4 sm:mb-5 px-1">
                    <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                      También puede que te guste
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
      <Dialog open={isMetadataEditorOpen} onOpenChange={setMetadataEditorOpen}>
        <DialogContent className="max-w-2xl bg-zinc-950 border-white/15 text-white">
          <DialogTitle>Editar metadatos</DialogTitle>
          <DialogDescription className="text-white/70">
            Cambios para {metadata?.type ?? "contenido"}.
          </DialogDescription>
          <form className="space-y-4" onSubmit={handleSaveMetadata}>
            <div className="space-y-2">
              <label className="text-sm text-white/80">Titulo</label>
              <Input
                value={metadataForm.title}
                onChange={(e) =>
                  setMetadataForm((prev) => ({ ...prev, title: e.target.value }))
                }
                className="bg-black/30 border-white/20 text-white"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm text-white/80">Titulo ordenado</label>
                <Input
                  value={metadataForm.titleSort}
                  onChange={(e) =>
                    setMetadataForm((prev) => ({
                      ...prev,
                      titleSort: e.target.value,
                    }))
                  }
                  className="bg-black/30 border-white/20 text-white"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-white/80">Titulo original</label>
                <Input
                  value={metadataForm.originalTitle}
                  onChange={(e) =>
                    setMetadataForm((prev) => ({
                      ...prev,
                      originalTitle: e.target.value,
                    }))
                  }
                  className="bg-black/30 border-white/20 text-white"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm text-white/80">Resumen</label>
              <textarea
                value={metadataForm.summary}
                onChange={(e) =>
                  setMetadataForm((prev) => ({ ...prev, summary: e.target.value }))
                }
                rows={4}
                className="w-full rounded-md border border-white/20 bg-black/30 px-3 py-2 text-sm text-white"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm text-white/80">Tagline</label>
                <Input
                  value={metadataForm.tagline}
                  onChange={(e) =>
                    setMetadataForm((prev) => ({ ...prev, tagline: e.target.value }))
                  }
                  className="bg-black/30 border-white/20 text-white"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-white/80">Estudio</label>
                <Input
                  value={metadataForm.studio}
                  onChange={(e) =>
                    setMetadataForm((prev) => ({ ...prev, studio: e.target.value }))
                  }
                  className="bg-black/30 border-white/20 text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm text-white/80">Clasificacion</label>
                <Input
                  value={metadataForm.contentRating}
                  onChange={(e) =>
                    setMetadataForm((prev) => ({
                      ...prev,
                      contentRating: e.target.value,
                    }))
                  }
                  className="bg-black/30 border-white/20 text-white"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-white/80">Ano</label>
                <Input
                  value={metadataForm.year}
                  onChange={(e) =>
                    setMetadataForm((prev) => ({ ...prev, year: e.target.value }))
                  }
                  className="bg-black/30 border-white/20 text-white"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm text-white/80">
                Fecha estreno (YYYY-MM-DD)
              </label>
              <Input
                value={metadataForm.originallyAvailableAt}
                onChange={(e) =>
                  setMetadataForm((prev) => ({
                    ...prev,
                    originallyAvailableAt: e.target.value,
                  }))
                }
                className="bg-black/30 border-white/20 text-white"
              />
            </div>

            {(metadata?.type === "season" || metadata?.type === "episode") && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm text-white/80">
                    {metadata?.type === "episode"
                      ? "Numero de episodio"
                      : "Numero de temporada"}
                  </label>
                  <Input
                    value={metadataForm.index}
                    onChange={(e) =>
                      setMetadataForm((prev) => ({ ...prev, index: e.target.value }))
                    }
                    className="bg-black/30 border-white/20 text-white"
                  />
                </div>
                {metadata?.type === "episode" && (
                  <div className="space-y-2">
                    <label className="text-sm text-white/80">
                      Numero de temporada
                    </label>
                    <Input
                      value={metadataForm.parentIndex}
                      onChange={(e) =>
                        setMetadataForm((prev) => ({
                          ...prev,
                          parentIndex: e.target.value,
                        }))
                      }
                      className="bg-black/30 border-white/20 text-white"
                    />
                  </div>
                )}
              </div>
            )}

            {metadataSaveError && (
              <p className="text-sm text-red-400">{metadataSaveError}</p>
            )}

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                className="border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white"
                onClick={() => {
                  setImageSaveError(null);
                  setImageEditorOpen(true);
                }}
              >
                Gestionar imagenes
              </Button>
              <Button
                type="button"
                variant="outline"
                className="border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white"
                onClick={() => setMetadataEditorOpen(false)}
                disabled={savingMetadata}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="bg-plex hover:bg-plex/80 text-white"
                disabled={savingMetadata}
              >
                {savingMetadata ? "Guardando..." : "Guardar cambios"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={isImageEditorOpen} onOpenChange={setImageEditorOpen}>
        <DialogContent className="max-w-3xl bg-zinc-950 border-white/15 text-white">
          <DialogTitle>Gestionar imagenes</DialogTitle>
          <DialogDescription className="text-white/70">
            Cambia poster, fondo y miniatura.
          </DialogDescription>
          <form className="space-y-4" onSubmit={handleSaveImages}>
            <div className="space-y-3 rounded-md border border-white/15 p-3 bg-black/20">
              <p className="text-sm font-medium text-white/90">URLs de imagen</p>
              <p className="text-xs text-white/60">
                Pega URLs publicas. Plex descargara y aplicara las imagenes.
              </p>
              <div className="grid grid-cols-1 gap-3">
                <div className="space-y-2">
                  <label className="text-sm text-white/80">Poster URL</label>
                  <Input
                    value={metadataForm.posterUrl}
                    onChange={(e) =>
                      setMetadataForm((prev) => ({
                        ...prev,
                        posterUrl: e.target.value,
                      }))
                    }
                    placeholder="https://..."
                    className="bg-black/30 border-white/20 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-white/80">Fondo URL</label>
                  <Input
                    value={metadataForm.artUrl}
                    onChange={(e) =>
                      setMetadataForm((prev) => ({
                        ...prev,
                        artUrl: e.target.value,
                      }))
                    }
                    placeholder="https://..."
                    className="bg-black/30 border-white/20 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-white/80">Miniatura URL</label>
                  <Input
                    value={metadataForm.thumbUrl}
                    onChange={(e) =>
                      setMetadataForm((prev) => ({
                        ...prev,
                        thumbUrl: e.target.value,
                      }))
                    }
                    placeholder="https://..."
                    className="bg-black/30 border-white/20 text-white"
                  />
                </div>
              </div>
              <div className="pt-2 border-t border-white/10">
                <p className="text-xs text-white/70 mb-2">
                  Sugerencias automáticas (como Plex):
                </p>
                {loadingImageSuggestions ? (
                  <p className="text-xs text-white/50">Buscando imágenes...</p>
                ) : (
                  <div className="space-y-3">
                    <SuggestionStrip
                      title="Posters sugeridos"
                      items={imageSuggestions.poster}
                      onSelect={(value) =>
                        setMetadataForm((prev) => ({ ...prev, posterUrl: value }))
                      }
                    />
                    <SuggestionStrip
                      title="Fondos sugeridos"
                      items={imageSuggestions.art}
                      onSelect={(value) =>
                        setMetadataForm((prev) => ({ ...prev, artUrl: value }))
                      }
                    />
                    <SuggestionStrip
                      title="Miniaturas sugeridas"
                      items={imageSuggestions.thumb}
                      onSelect={(value) =>
                        setMetadataForm((prev) => ({ ...prev, thumbUrl: value }))
                      }
                    />
                  </div>
                )}
              </div>
            </div>

            {imageSaveError && (
              <p className="text-sm text-red-400">{imageSaveError}</p>
            )}

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                className="border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white"
                onClick={() => setImageEditorOpen(false)}
                disabled={savingImages}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="bg-plex hover:bg-plex/80 text-white"
                disabled={savingImages}
              >
                {savingImages ? "Guardando..." : "Guardar imagenes"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
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
