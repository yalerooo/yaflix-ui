"use client";

import { FC, useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactPlayer from "react-player";
import { ServerApi, streamprops } from "@/api";
import qs from "qs";
import { createPortal } from "react-dom";
import { clearAllBodyScrollLocks, disableBodyScroll } from "body-scroll-lock";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Slider } from "@/components/ui/slider";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  LoaderCircle,
  Maximize,
  Minimize,
  Music,
  Pause,
  PictureInPicture,
  Play,
  Settings,
  SkipForward,
  Sparkles,
  Subtitles,
  Volume1,
  Volume2,
  VolumeX,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { VideoSeekSlider } from "react-video-seek-slider";
import "react-video-seek-slider/styles.css";
import { getFormatedTime } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { getCoverImage } from "@/hooks/use-hub-item";
import { useSettings } from "@/components/settings-provider";

export const WatchScreen: FC<{ watch: string | undefined }> = ({ watch }) => {
  const router = useRouter();
  const pathname = usePathname();
  const container = useRef<HTMLDivElement>(null);
  const searchParams = useSearchParams();
  const { t } = useSettings();
  const [metadata, setMetadata] = useState<Plex.Metadata | null>(null);
  const [playQueue, setPlayQueue] = useState<Plex.Metadata[] | null>(null); // [current, ...next]
  const player = useRef<ReactPlayer | null>(null);
  const [quality, setQuality] = useState<{
    bitrate?: number;
    auto?: boolean;
  }>({
    ...(localStorage.getItem("quality") && {
      bitrate: parseInt(localStorage.getItem("quality") ?? "10000"),
    }),
    auto: false,
  });
  const [volume, setVolume] = useState<number>(
    parseInt(localStorage.getItem("volume") ?? "100"),
  );
  const lastAppliedTime = useRef<number>(0);
  const [playing, setPlaying] = useState(true);
  const [ready, setReady] = useState(false);
  const seekToAfterLoad = useRef<number | null>(null);
  const [progress, setProgress] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [isMuted, setIsMuted] = useState(
    localStorage.getItem("is_watch_muted") === "true",
  );
  const [buffering, setBuffering] = useState(false);
  const [showError, setShowError] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [pendingRefresh, setPendingRefresh] = useState(false);
  const [url, setUrl] = useState<string>("");
  const [playerKey, setPlayerKey] = useState(0);
  const isReloading = useRef(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dashInstanceRef = useRef<any>(null);
  const [isLoadingMetadata, setIsLoadingMetadata] = useState<boolean>(false);
  const [isPipAvailable, setIsPipAvailable] = useState<boolean>(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsView, setSettingsView] = useState<'main' | 'quality' | 'audio' | 'subtitles'>('main');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [videoWidth, setVideoWidth] = useState<number>(0);
  const [isMobileLike, setIsMobileLike] = useState(false);
  const controlsHideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const clearControlsTimer = useCallback(() => {
    if (controlsHideTimeoutRef.current) {
      clearTimeout(controlsHideTimeoutRef.current);
      controlsHideTimeoutRef.current = null;
    }
  }, []);

  const scheduleControlsHide = useCallback(() => {
    if (isMobileLike) return;
    clearControlsTimer();
    controlsHideTimeoutRef.current = setTimeout(() => {
      setShowControls(false);
    }, 3000);
  }, [clearControlsTimer, isMobileLike]);

  const revealControls = useCallback(() => {
    setShowControls(true);
    if (!isMobileLike) {
      scheduleControlsHide();
    }
  }, [isMobileLike, scheduleControlsHide]);

  const toggleControlsVisibility = useCallback(() => {
    setShowControls((prev) => {
      const next = !prev;
      if (next && !isMobileLike) {
        scheduleControlsHide();
      } else {
        clearControlsTimer();
      }
      return next;
    });
  }, [clearControlsTimer, isMobileLike, scheduleControlsHide]);

  const lockLandscapeIfPossible = useCallback(async () => {
    try {
      const orientationApi = screen.orientation as ScreenOrientation & {
        lock?: (orientation: string) => Promise<void>;
      };
      if ("orientation" in screen && typeof orientationApi.lock === "function") {
        await orientationApi.lock("landscape");
      }
    } catch {
      // Ignore unsupported/permission errors (common on desktop/iOS).
    }
  }, []);

  const unlockOrientationIfPossible = useCallback(() => {
    try {
      const orientationApi = screen.orientation as ScreenOrientation & {
        unlock?: () => void;
      };
      if (
        "orientation" in screen &&
        typeof orientationApi.unlock === "function"
      ) {
        orientationApi.unlock();
      }
    } catch {
      // ignore
    }
  }, []);

  const toggleFullscreenPlayer = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        const target = container.current ?? document.documentElement;
        if ("requestFullscreen" in target) {
          await target.requestFullscreen();
          await lockLandscapeIfPossible();
        }
      } else {
        await document.exitFullscreen();
        unlockOrientationIfPossible();
      }
    } catch (error) {
      console.error("Fullscreen error:", error);
    }
  }, [lockLandscapeIfPossible, unlockOrientationIfPossible]);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 768px), (pointer: coarse)");
    const update = () => setIsMobileLike(media.matches);
    update();
    media.addEventListener?.("change", update);
    window.addEventListener("resize", update);
    return () => {
      media.removeEventListener?.("change", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
      if (!document.fullscreenElement) {
        unlockOrientationIfPossible();
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, [unlockOrientationIfPossible]);

  useEffect(() => {
    const updateVideoWidth = () => {
      const videoElement = document.querySelector('video') as HTMLVideoElement;
      if (!videoElement || document.fullscreenElement) {
        return;
      }

      // Esperar a que el video tenga dimensiones
      if (videoElement.videoWidth === 0 || videoElement.videoHeight === 0) {
        return;
      }

      const videoAspect = videoElement.videoWidth / videoElement.videoHeight;
      const containerWidth = videoElement.offsetWidth;
      const containerHeight = videoElement.offsetHeight;
      const containerAspect = containerWidth / containerHeight;

      let renderedWidth: number;

      if (containerAspect > videoAspect) {
        // El contenedor es más ancho, el video está limitado por altura
        renderedWidth = containerHeight * videoAspect;
      } else {
        // El contenedor es más alto, el video está limitado por ancho
        renderedWidth = containerWidth;
      }

      // Restamos un pequeño margen lateral para estrechar la barra
      const lateralMargin = 40; // 20px de cada lado
      setVideoWidth(Math.round(renderedWidth - lateralMargin));
    };

    const videoElement = document.querySelector('video');
    if (videoElement) {
      videoElement.addEventListener('loadedmetadata', updateVideoWidth);
      videoElement.addEventListener('resize', updateVideoWidth);
    }

    updateVideoWidth();
    window.addEventListener('resize', updateVideoWidth);
    
    const intervalId = setInterval(updateVideoWidth, 500);

    return () => {
      window.removeEventListener('resize', updateVideoWidth);
      if (videoElement) {
        videoElement.removeEventListener('loadedmetadata', updateVideoWidth);
        videoElement.removeEventListener('resize', updateVideoWidth);
      }
      clearInterval(intervalId);
    };
  }, [ready, url]);

  const reloadPlayer = useCallback((newUrl: string) => {
    isReloading.current = true;
    // 1. Reset the stored DASH.js instance to stop all pending XHR requests.
    if (dashInstanceRef.current) {
      try {
        if (typeof dashInstanceRef.current.reset === 'function') {
          dashInstanceRef.current.reset();
        }
      } catch { /* ignore */ }
      dashInstanceRef.current = null;
    }
    // 2. Nuke every <video> element's media pipeline so MSE buffers stop playing.
    document.querySelectorAll('video').forEach((v) => {
      try {
        v.muted = true;
        (v as HTMLVideoElement).volume = 0;
        v.pause();
        // Detach MSE srcObject if present, then also clear src and reset element.
        if ((v as any).srcObject !== undefined) (v as any).srcObject = null;
        v.removeAttribute('src');
        v.load(); // Cancels all pending buffering/decoding (HTML spec §4.8.11.5)
      } catch { /* ignore */ }
    });
    // 3. Increment key (unmounts old player) and set new URL atomically.
    setPlayerKey((k) => k + 1);
    setUrl(newUrl);
  }, []);

  const video = useMemo(() => {
    if (!ready) return null;

    return document.querySelector("video");
  }, [ready]);

  const loaded = (offsetMs = 0) =>
    `${localStorage.getItem("server")}/video/:/transcode/universal/start.mpd?${qs.stringify(
      {
        ...streamprops({
          id: watch ?? "",
          limitation: {
            ...(quality.bitrate && {
              maxVideoBitrate: quality
                ? quality.bitrate
                : parseInt(localStorage.getItem("quality") ?? "10000"),
            }),
          },
        }),
        ...(offsetMs > 0 ? { offset: Math.floor(offsetMs) } : {}),
      },
    )}`;

  const loadMetadata = async (id: string) => {
    setIsLoadingMetadata(true);
    let Metadata: Plex.Metadata | null = null;
    await ServerApi.metadata({ id }).then((metadata) => {
      if (!metadata) return;

      Metadata = metadata;
      if (metadata.type === "movie" || metadata.type === "episode") {
        setMetadata(metadata);
        if (metadata.type === "episode") {
          ServerApi.metadata({
            id: metadata.grandparentRatingKey as string,
          });
        }
      } else {
        console.error("Invalid metadata type");
      }
    });

    if (!Metadata) return;

    await ServerApi.decision({
      id,
      limitation: {
        maxVideoBitrate: quality.bitrate,
        autoAdjustQuality: quality.auto,
      },
    });

    const serverPreferences = await ServerApi.preferences();

    if (serverPreferences) {
      ServerApi.queue({
        uri: `server://${
          serverPreferences.machineIdentifier
        }/com.plexapp.plugins.library/library/metadata/${
          (Metadata as Plex.Metadata).ratingKey
        }`,
      }).then((queue) => {
        setPlayQueue(queue);
      });
    }

    setIsLoadingMetadata(false);
  };

  useEffect(() => {
    if (isMobileLike) {
      clearControlsTimer();
      return;
    }

    let timeout: NodeJS.Timeout | null = null;
    const move = () => {
      if (timeout) clearTimeout(timeout);
      revealControls();
    };

    const exit = () => {
      if (timeout) clearTimeout(timeout);
      setShowControls(false);
      clearControlsTimer();
    };

    document.addEventListener("mouseleave", exit);
    document.addEventListener("mousemove", move);
    return () => {
      document.removeEventListener("mouseleave", exit);
      document.removeEventListener("mousemove", move);
      clearControlsTimer();
    };
  }, [clearControlsTimer, isMobileLike, revealControls]);

  const timeline = (state: "playing" | "stopped" | "paused" | "buffering") => {
    if (player.current && watch) {
      ServerApi.timeline({
        id: parseInt(watch),
        duration: Math.floor(player.current.getDuration()) * 1000,
        state: state,
        time: Math.floor(progress) * 1000,
      }).then();
    }
  };

  useEffect(() => {
    if (!watch) return;

    const updateTimeline = async () => {
      if (!player.current) return;
      const timelineUpdateData = await ServerApi.timeline({
        id: parseInt(watch),
        duration: Math.floor(player.current.getDuration()) * 1000,
        state: buffering ? "buffering" : playing ? "playing" : "paused",
        time: Math.floor(progress) * 1000,
      });

      if (!timelineUpdateData) return;

      const { terminationCode } = timelineUpdateData.MediaContainer;
      if (terminationCode) {
        setPlaying(false);
      }
    };

    const updateInterval = setInterval(updateTimeline, 10000);

    return () => {
      clearInterval(updateInterval);
    };
  }, [buffering, watch, playing]);

  useEffect(() => {
    if (!watch) {
      setUrl("");
      setMetadata(null);
      setPlayQueue(null);
      setPlaying(false);
      setReady(false);
    }

    (async () => {
      setReady(false);

      if (!watch) return;

      await loadMetadata(watch);
      setUrl(loaded());
      setShowError(false);
    })();
  }, [watch]);

  useEffect(() => {
    if (!video) return;

    if (
      "pictureInPictureEnabled" in document &&
      // @ts-ignore
      video.requestPictureInPicture
    ) {
      setIsPipAvailable(true);
    } else {
      setIsPipAvailable(false);
    }

    if (ready && !playing) {
      setPlaying(true);
      timeline("playing");
    }

    return () => {
      setIsPipAvailable(false);
    };
  }, [video]);

  const next = useMemo(() => (playQueue && playQueue[1]) ?? null, [playQueue]);

  const handleNext = useCallback(() => {
    if (next) {
      router.replace(`${pathname}?watch=${next.ratingKey}`, {
        scroll: false,
      });
    }
  }, [next]);

  useEffect(() => {
    if ("mediaSession" in navigator) {
      navigator.mediaSession.setActionHandler("nexttrack", () => {
        handleNext();
      });
    }
  }, [handleNext]);

  // playback controll buttons
  // SPACE: play/pause
  // LEFT: seek back 10 seconds
  // RIGHT: seek forward 10 seconds
  // UP: increase volume
  // DOWN: decrease volume
  // , (comma): Back 1 frame
  // . (period): Forward 1 frame
  // F: Maximize/Minimize
  // M: Mute/Unmute
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      e.stopPropagation();
      e.stopImmediatePropagation();

      if (e.key === " " && player.current) {
        setPlaying((state) => !state);
      }
      if (e.key === "ArrowLeft" && player.current) {
        player.current.seekTo(player.current.getCurrentTime() - 10);
      }
      if (e.key === "ArrowRight" && player.current) {
        player.current.seekTo(player.current.getCurrentTime() + 10);
      }
      if (e.key === "ArrowUp" && player.current) {
        setVolume((state) => {
          const value = Math.min(state + 5, 100);
          localStorage.setItem("volume", value.toString());
          return value;
        });
        setIsMuted(() => {
          localStorage.setItem("is_watch_muted", "false");
          return false;
        });
      }
      if (e.key === "ArrowDown" && player.current) {
        setVolume((state) => {
          const value = Math.max(state - 5, 0);
          localStorage.setItem("volume", value.toString());
          return value;
        });
        setIsMuted(() => {
          localStorage.setItem("is_watch_muted", "false");
          return false;
        });
      }
      if (e.key === "," && player.current) {
        player.current.seekTo(player.current.getCurrentTime() - 0.04);
      }
      if (e.key === "." && player.current) {
        player.current.seekTo(player.current.getCurrentTime() + 0.04);
      }
      if (e.key === "f" && player.current) {
        toggleFullscreenPlayer();
      }
      if (e.key === "m") {
        setIsMuted((prev) => {
          localStorage.setItem("is_watch_muted", prev ? "false" : "true");
          return !prev;
        });
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      if (watch !== undefined && player.current !== null) {
        timeline("stopped");
      }
    };
  }, [toggleFullscreenPlayer]);

  // Disable body scroll
  useEffect(() => {
    if (watch && container.current) {
      disableBodyScroll(container.current);
    } else {
      clearAllBodyScrollLocks();
    }
    return () => {
      clearAllBodyScrollLocks();
      lastAppliedTime.current = 0;
    };
  }, [container, watch]);

  const back = () => {
    // Salir de pantalla completa si está activo
    if (document.fullscreenElement) {
      document.exitFullscreen();
    }
    timeline("stopped");
    router.back();
  };

  const videoOptions = useMemo(
    () =>
      metadata?.Media && metadata.Media.length > 0
        ? getCurrentVideoLevels(metadata.Media[0].videoResolution, t).filter(
            (opt) => opt.bitrate,
          )
        : [],
    [metadata?.Media],
  );
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

  const showSkip =
    metadata?.Marker &&
    metadata?.Marker.filter(
      (marker) =>
        marker.startTimeOffset / 1000 <= progress &&
        marker.endTimeOffset / 1000 >= progress &&
        marker.type === "intro",
    ).length > 0;

  const showCredit =
    metadata?.Marker &&
    metadata?.Marker.filter(
      (marker) =>
        marker.startTimeOffset / 1000 <= progress &&
        marker.endTimeOffset / 1000 >= progress &&
        marker.type === "credits" &&
        !marker.final,
    ).length > 0;

  const token = localStorage.getItem("token");

  if (!watch) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col bg-black" ref={container}>
      {metadata && !isLoadingMetadata ? (
        <>
          <div
            className={`absolute inset-0 ${showControls ? "" : "cursor-none"}`}
          >
            <ReactPlayer
              key={playerKey}
              ref={player}
              playing={playing}
              volume={(isMuted ? 0 : volume) / 100}
              onClick={(e: MouseEvent) => {
                e.preventDefault();

                switch (e.detail) {
                  case 1:
                    if (isMobileLike) {
                      toggleControlsVisibility();
                    } else {
                      revealControls();
                    }
                    break;
                  case 2:
                    toggleFullscreenPlayer();
                    break;
                  default:
                    break;
                }
              }}
              onSeek={(seconds) => {
                if (player.current !== null) {
                  setProgress(seconds);
                  ServerApi.timeline({
                    id: parseInt(watch),
                    duration: Math.floor(player.current.getDuration()) * 1000,
                    state: buffering
                      ? "buffering"
                      : playing
                        ? "playing"
                        : "paused",
                    time: Math.floor(seconds) * 1000,
                  });
                }
              }}
              onReady={() => {
                isReloading.current = false;
                // Capture the live DASH.js instance so we can reset it on reload.
                dashInstanceRef.current =
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  (player.current as any)?.getInternalPlayer?.('dash') ?? null;
                if (!player.current) return;
                setReady(true);
                setShowError(false);

                if (seekToAfterLoad.current !== null) {
                  player.current.seekTo(seekToAfterLoad.current);
                  seekToAfterLoad.current = null;
                }

                if (!searchParams.has("t")) return;
                const t = parseInt(searchParams.get("t") ?? "0");

                if (lastAppliedTime.current === t) {
                  return;
                }

                player.current.seekTo(t / 1000);
                lastAppliedTime.current = t;
              }}
              onProgress={(progress) => {
                setProgress(progress.playedSeconds);
                setBuffered(progress.loadedSeconds);
              }}
              onPause={() => {
                if (isReloading.current) return;
                setPlaying(false);
                if (playing) {
                  timeline("paused");
                }
                revealControls();
              }}
              onPlay={() => {
                setPlaying(true);
                if (!playing) {
                  timeline("playing");
                }
              }}
              onBuffer={() => {
                setBuffering(true);
              }}
              onBufferEnd={() => {
                setBuffering(false);
              }}
              onError={(err) => {
                if (isReloading.current) return;
                console.error(err);
                if (err?.error?.message) {
                  if (
                    (err.error.message.includes("/header") ||
                      err.error.message.includes(".m4s")) &&
                    err.error.message.includes("is not available") &&
                    !isLoadingMetadata
                  ) {
                    setShowError(true);
                  }
                }

                setPlaying(false);
              }}
              onEnded={() => {
                if (!playQueue) {
                  // TODO: maybe call back
                  return console.log("No play queue");
                }

                if (metadata.type !== "episode") {
                  router.push(
                    `/browse/${metadata.librarySectionID}?${qs.stringify({
                      mid: metadata.ratingKey,
                    })}`,
                    { scroll: false },
                  );
                  return;
                }

                const next = playQueue[1];
                if (!next) {
                  router.push(
                    `/browse/${metadata.librarySectionID}?${qs.stringify({
                      mid: metadata.grandparentRatingKey,
                      pid: metadata.parentRatingKey,
                      iid: metadata.ratingKey,
                    })}`,
                    { scroll: false },
                  );
                  return;
                }

                router.replace(`${pathname}?watch=${next.ratingKey}`, {
                  scroll: false,
                });
              }}
              config={{
                file: {
                  forceDisableHls: true,
                  forceDASH: true,
                  dashVersion: "4.7.0",
                  attributes: {
                    controlsList: "nodownload",
                    disablePictureInPicture: false,
                    disableRemotePlayback: true,
                    autoPlay: true,
                    poster: getCoverImage(metadata.art, true),
                    crossorigin: "anonymous",
                  },
                },
              }}
              controls={false}
              stopOnUnmount={true}
              url={url}
              width="100%"
              height="100%"
              pip
            />
          </div>
          <div
            className={`sticky top-0 w-full flex flex-row items-center gap-2 sm:gap-4 p-3 sm:p-6 bg-background/80 transition-transform duration-300 ease-in-out ${showControls ? "" : "-translate-y-full"}`}
          >
            <button
              onClick={() => back()}
              className="group w-fit without-ring"
              id="button-back"
              onKeyDown={(event) => {
                if (event.key === " ") {
                  event.preventDefault();
                }
              }}
            >
              <ArrowLeft className="w-6 h-6 sm:w-8 sm:h-8 text-muted-foreground group-hover:scale-125 hover:text-primary transition duration-75" />
            </button>
            <p className="font-semibold text-white select-none line-clamp-1 text-sm sm:text-base min-w-0">
              {metadata.type === "movie" && metadata.title}
              {metadata.type === "episode" && (
                <span>
                  <button
                    id="button-grandparent-top"
                    className="without-ring hover:text-primary transition-colors"
                    onKeyDown={(event) => {
                      if (event.key === " ") {
                        event.preventDefault();
                      }
                    }}
                    onClick={() =>
                      router.push(
                        `${pathname}?mid=${metadata.grandparentRatingKey}`,
                        { scroll: false },
                      )
                    }
                  >
                    {metadata.grandparentTitle}
                  </button>
                  {" - "}
                  <button
                    id="button-parent-top"
                    className="without-ring hover:text-primary transition-colors"
                    onKeyDown={(event) => {
                      if (event.key === " ") {
                        event.preventDefault();
                      }
                    }}
                    onClick={() =>
                      router.push(
                        `${pathname}?mid=${metadata.parentRatingKey}`,
                        { scroll: false },
                      )
                    }
                  >
                    S{metadata.parentIndex?.toString().padStart(2, "0")}
                  </button>
                  E{metadata.index?.toString().padStart(2, "0")}
                  {" - "}
                  {metadata.title}
                </span>
              )}
            </p>
          </div>
          <div className="flex-1" />
          <div
            className={`flex flex-row p-3 sm:p-6 justify-end z-50 transition-opacity duration-300 ${showSkip ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
            autoFocus
          >
            <Button
              type="button"
              variant="outline"
              id="button-skipintro"
              autoFocus={showSkip}
              onClick={() => {
                if (!player.current || !metadata?.Marker) return;
                const time =
                  metadata.Marker?.filter(
                    (marker) =>
                      marker.startTimeOffset / 1000 <= progress &&
                      marker.endTimeOffset / 1000 >= progress &&
                      marker.type === "intro",
                  )[0].endTimeOffset / 1000;
                player.current.seekTo(time + 1);
              }}
            >
              <SkipForward /> Skip Intro
            </Button>
          </div>
          <div
            className={`flex flex-row p-3 sm:p-6 justify-end z-50 transition-opacity duration-300 ${showCredit ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
            autoFocus
          >
            <Button
              type="button"
              variant="outline"
              id="button-skipcredit"
              autoFocus={showCredit}
              onClick={() => {
                if (!player.current || !metadata?.Marker) return;
                const time =
                  metadata.Marker?.filter(
                    (marker) =>
                      marker.startTimeOffset / 1000 <= progress &&
                      marker.endTimeOffset / 1000 >= progress &&
                      marker.type === "credits" &&
                      !marker.final,
                  )[0].endTimeOffset / 1000;
                player.current.seekTo(time + 1);
              }}
            >
              <SkipForward /> Skip Credit
            </Button>
          </div>
          <div
            className={`sticky bottom-0 w-full px-2 sm:px-3 ${showControls ? "" : "translate-y-full"} transition-all duration-300`}
          >
            <div 
              className={`mx-auto w-full transition-all duration-300`}
              style={!isFullscreen && videoWidth > 0 ? { maxWidth: `${videoWidth}px` } : undefined}
            >
            {metadata && (
              <VideoSeekSlider
                max={(player.current?.getDuration() ?? 0) * 1000}
                currentTime={progress * 1000}
                bufferTime={buffered * 1000}
                onChange={(value) => {
                  player.current?.seekTo(value / 1000);
                }}
                limitTimeTooltipBySides={true}
                secondsPrefix="00:"
                minutesPrefix="0:"
                getPreviewScreenUrl={(value) => {
                  if (!metadata.Media || !metadata.Media[0].Part[0].indexes)
                    return "";
                  return `${localStorage.getItem(
                    "server",
                  )}/photo/:/transcode?${qs.stringify({
                    width: "240",
                    height: "135",
                    minSize: "1",
                    upscale: "1",
                    url: `/library/parts/${
                      metadata.Media[0].Part[0].id
                    }/indexes/sd/${value}?X-Plex-Token=${
                      localStorage.getItem("token") as string
                    }`,
                    "X-Plex-Token": localStorage.getItem("token") as string,
                  })}`;
                }}
              />
            )}
            <div
              aria-label="controls"
              className="flex flex-wrap gap-2 sm:gap-3 items-center pb-3 pt-2"
            >
              <div className="flex items-center gap-1 bg-black/60 backdrop-blur-sm rounded-full px-1 py-1 sm:px-1.5 sm:py-1.5">
              <button
                id="button-play"
                className="without-ring hover:bg-white/15 rounded-full p-1.5 transition-all"
                onKeyDown={(event) => {
                  if (event.key === " ") {
                    event.preventDefault();
                  }
                }}
                onClick={() => {
                  setPlaying(!playing);
                  if (playing) {
                    timeline("paused");
                  } else {
                    timeline("playing");
                  }
                }}
              >
                {playing ? (
                  <Pause
                    className="w-6 h-6 sm:w-7 sm:h-7 text-white hover:scale-105 transition duration-150"
                    fill="currentColor"
                  />
                ) : (
                  <Play
                    className="w-6 h-6 sm:w-7 sm:h-7 text-white hover:scale-105 transition duration-150"
                    fill="currentColor"
                  />
                )}
              </button>
              <div className="flex group items-center gap-1">
                <button
                  id="button-volume"
                  className="without-ring hover:bg-white/15 rounded-full p-1.5 transition-all"
                  onKeyDown={(event) => {
                    if (event.key === " ") {
                      event.preventDefault();
                    }
                  }}
                  onClick={() => {
                    localStorage.setItem(
                      "is_watch_muted",
                      isMuted ? "false" : "true",
                    );
                    setIsMuted(!isMuted);
                  }}
                >
                  {volume === 0 || isMuted ? (
                    <VolumeX className="w-5 h-5 sm:w-6 sm:h-6 text-white hover:scale-105 transition duration-150" />
                  ) : volume < 45 ? (
                    <Volume1 className="w-5 h-5 sm:w-6 sm:h-6 text-white hover:scale-105 transition duration-150" />
                  ) : (
                    <Volume2 className="w-5 h-5 sm:w-6 sm:h-6 text-white hover:scale-105 transition duration-150" />
                  )}
                </button>
                <div className="overflow-hidden w-0 group-hover:w-24 transition-all duration-200 pointer-events-none group-hover:pointer-events-auto">
                  <Slider
                    className="w-24 h-full opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                    value={[isMuted ? 0 : volume]}
                    defaultValue={[isMuted ? 0 : volume]}
                    max={100}
                    min={0}
                    step={1}
                    onValueChange={(value) => {
                      localStorage.setItem("volume", value[0].toString());
                      setVolume(value[0]);
                      localStorage.setItem("is_watch_muted", "false");
                      setIsMuted(false);
                    }}
                  />
                </div>
              </div>
              <div className="bg-black/60 backdrop-blur-sm rounded-full px-2 sm:px-3 py-1.5">
                <p className="text-white text-[10px] sm:text-xs font-medium tabular-nums">
                  {getFormatedTime(progress)} / {getFormatedTime(player.current?.getDuration() ?? 0)}
                </p>
              </div>
              </div>
              <div className="flex-1" />
              <div className="flex items-center gap-1 bg-black/60 backdrop-blur-sm rounded-full px-1 py-1 sm:px-1.5 sm:py-1.5 ml-auto">
              {next && (
                <TooltipProvider delayDuration={100}>
                  <Tooltip>
                    <TooltipTrigger asChild id="button-next">
                      <button
                        className="without-ring hover:bg-white/15 rounded-full p-1.5 transition-all"
                        onKeyDown={(event) => {
                          if (event.key === " ") {
                            event.preventDefault();
                          }
                        }}
                        onClick={() => handleNext()}
                      >
                        <SkipForward className="w-5 h-5 sm:w-6 sm:h-6 text-white hover:scale-105 transition duration-150" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent
                      side="top"
                      align="start"
                      className={`p-0 m-4 ${showControls ? "" : "hidden"} flex flex-row glass-dark backdrop-blur-xl border border-white/20 rounded-2xl overflow-hidden max-w-[600px] max-h-[${9 * 20}px]`}
                    >
                      <img
                        loading="lazy"
                        width={16 * 20}
                        height={9 * 20}
                        className="aspect-video object-cover"
                        src={`${localStorage.getItem("server")}/photo/:/transcode?${qs.stringify(
                          {
                            width: 16 * 20,
                            height: 9 * 20,
                            url: `${next.thumb}?X-Plex-Token=${token}`,
                            minSize: 1,
                            upscale: 1,
                            "X-Plex-Token": token,
                          },
                        )}`}
                        alt={t("watch.previewPosterAlt")}
                      />
                      <div className="p-4 text-white">
                        <p className="text-xl line-clamp-1 font-bold">
                          {next.title}
                        </p>
                        <p className="text-sm font-semibold text-white/70">
                          S{next.parentIndex?.toString().padStart(2, "0")}E
                          {next.index?.toString().padStart(2, "0")}
                        </p>
                        <p className="text-sm line-clamp-6 text-white/80 mt-1">{next.summary}</p>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              {isPipAvailable && (
                <button
                  className="without-ring hover:bg-white/15 rounded-full p-1.5 transition-all"
                  onClick={async () => {
                    try {
                      if (document.pictureInPictureElement) {
                        await document.exitPictureInPicture();
                      } else if (video) {
                        await video.requestPictureInPicture();
                      }
                    } catch (error) {
                      console.error("PiP error:", error);
                    }
                  }}
                  onKeyDown={(event) => {
                    if (event.key === " ") {
                      event.preventDefault();
                    }
                  }}
                  id="button-pip"
                >
                  <PictureInPicture className="w-5 h-5 sm:w-6 sm:h-6 text-white hover:scale-105 transition duration-150" />
                </button>
              )}
              <Popover open={settingsOpen} onOpenChange={(open) => {
                setSettingsOpen(open);
                if (!open) setSettingsView('main');
              }}>
                <PopoverTrigger asChild>
                  <button
                    className="without-ring hover:bg-white/15 rounded-full p-1.5 transition-all"
                    onKeyDown={(event) => {
                      if (event.key === " ") {
                        event.preventDefault();
                      }
                    }}
                    id="button-settings"
                  >
                    <Settings className="w-5 h-5 sm:w-6 sm:h-6 text-white hover:scale-105 transition duration-150" />
                  </button>
                </PopoverTrigger>
                <PopoverContent 
                  side="top" 
                  align="end" 
                  className="w-[calc(100vw-1rem)] sm:w-80 max-w-80 p-0 glass-dark backdrop-blur-xl border-white/20 rounded-2xl overflow-hidden"
                  sideOffset={30}
                  container={container.current}
                >
                  {/* Main Menu */}
                  {settingsView === 'main' && (
                    <div className="py-2">
                      {videoOptions.length > 0 && (
                        <button
                          onClick={() => setSettingsView('quality')}
                          className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/10 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <Sparkles className="w-5 h-5 text-white/80" />
                            <span className="text-white font-medium">{t("watch.quality")}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-white/60 text-sm">
                              {videoOptions.find(opt => opt.bitrate?.toString() === quality.bitrate?.toString())?.extra || t("watch.automatic")}
                            </span>
                            <ChevronRight className="w-5 h-5 text-white/60" />
                          </div>
                        </button>
                      )}
                      
                      {audioOptions.length > 0 && (
                        <button
                          onClick={() => setSettingsView('audio')}
                          className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/10 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <Music className="w-5 h-5 text-white/80" />
                            <span className="text-white font-medium">{t("watch.audio")}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-white/60 text-sm line-clamp-1 max-w-[140px]">
                              {audioOptions.find(opt => opt.selected)?.displayTitle || t("watch.defaultAudio")}
                            </span>
                            <ChevronRight className="w-5 h-5 text-white/60" />
                          </div>
                        </button>
                      )}
                      
                      {subtitleOptions.length > 0 && (
                        <button
                          onClick={() => setSettingsView('subtitles')}
                          className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/10 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <Subtitles className="w-5 h-5 text-white/80" />
                            <span className="text-white font-medium">{t("watch.subtitles")}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-white/60 text-sm line-clamp-1 max-w-[140px]">
                              {subtitleOptions.find(opt => opt.selected)?.displayTitle || t("watch.subtitlesOff")}
                            </span>
                            <ChevronRight className="w-5 h-5 text-white/60" />
                          </div>
                        </button>
                      )}
                    </div>
                  )}
                  
                  {/* Quality Submenu */}
                  {settingsView === 'quality' && (
                    <div className="py-2">
                      <div className="px-4 py-3 flex items-center gap-3 border-b border-white/10">
                        <button
                          onClick={() => setSettingsView('main')}
                          className="hover:bg-white/10 rounded-lg p-1 transition-colors"
                        >
                          <ChevronLeft className="w-5 h-5 text-white" />
                        </button>
                        <span className="text-white font-semibold">{t("watch.quality")}</span>
                      </div>
                      <div className="max-h-[400px] overflow-y-auto">
                        {videoOptions.map((option) => (
                          <button
                            key={option.bitrate}
                            onClick={async () => {
                              await loadMetadata(watch);
                              setIsLoadingMetadata(true);
                              await ServerApi.decision({
                                id: watch,
                                limitation: {
                                  maxVideoBitrate: option.bitrate,
                                  autoAdjustQuality: quality.auto,
                                },
                              });
                              setIsLoadingMetadata(false);

                              setQuality({
                                bitrate: option.original ? undefined : option.bitrate,
                                auto: undefined,
                              });

                              if (option.original) {
                                localStorage.removeItem("quality");
                              } else if (option.bitrate) {
                                localStorage.setItem("quality", option.bitrate.toString());
                              }

                              const currentMs = Math.floor((player.current?.getCurrentTime() ?? 0) * 1000);
                              seekToAfterLoad.current = currentMs / 1000;
                              reloadPlayer(loaded(currentMs));
                              setSettingsView('main');
                            }}
                            className={`w-full px-4 py-3 flex items-center justify-between hover:bg-white/10 transition-colors ${
                              quality.bitrate?.toString() === option.bitrate?.toString() ? 'bg-white/5' : ''
                            }`}
                          >
                            <span className="text-white">{option.title} <span className="text-white/60">{option.extra}</span></span>
                            {quality.bitrate?.toString() === option.bitrate?.toString() && (
                              <div className="w-2 h-2 rounded-full bg-plex"></div>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Audio Submenu */}
                  {settingsView === 'audio' && (
                    <div className="py-2">
                      <div className="px-4 py-3 flex items-center gap-3 border-b border-white/10">
                        <button
                          onClick={() => setSettingsView('main')}
                          className="hover:bg-white/10 rounded-lg p-1 transition-colors"
                        >
                          <ChevronLeft className="w-5 h-5 text-white" />
                        </button>
                        <span className="text-white font-semibold">{t("watch.audio")}</span>
                      </div>
                      <div className="max-h-[400px] overflow-y-auto">
                        {audioOptions.map((option) => (
                          <button
                            key={option.id}
                            onClick={async () => {
                              await ServerApi.audio({
                                part: metadata?.Media ? metadata?.Media[0].Part[0].id.toString() : "",
                                stream: option.id.toString(),
                              });
                              await loadMetadata(watch);
                              await ServerApi.decision({
                                id: watch,
                                limitation: {
                                  maxVideoBitrate: quality.bitrate,
                                  autoAdjustQuality: quality.auto,
                                },
                              });

                              const currentMs = Math.floor((player.current?.getCurrentTime() ?? 0) * 1000);
                              seekToAfterLoad.current = currentMs / 1000;
                              reloadPlayer(loaded(currentMs));
                              setSettingsView('main');
                            }}
                            className={`w-full px-4 py-3 flex items-center justify-between hover:bg-white/10 transition-colors ${
                              option.selected ? 'bg-white/5' : ''
                            }`}
                          >
                            <span className="text-white text-left">{option.extendedDisplayTitle}</span>
                            {option.selected && (
                              <div className="w-2 h-2 rounded-full bg-plex"></div>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Subtitles Submenu */}
                  {settingsView === 'subtitles' && (
                    <div className="py-2">
                      <div className="px-4 py-3 flex items-center gap-3 border-b border-white/10">
                        <button
                          onClick={() => setSettingsView('main')}
                          className="hover:bg-white/10 rounded-lg p-1 transition-colors"
                        >
                          <ChevronLeft className="w-5 h-5 text-white" />
                        </button>
                        <span className="text-white font-semibold">{t("watch.subtitles")}</span>
                      </div>
                      <div className="max-h-[400px] overflow-y-auto">
                        <button
                          onClick={async () => {
                            await ServerApi.subtitle({
                              part: metadata?.Media ? metadata?.Media[0].Part[0].id.toString() : "",
                              stream: "0",
                            });
                            await loadMetadata(watch);
                            await ServerApi.decision({
                              id: watch,
                              limitation: {
                                maxVideoBitrate: quality.bitrate,
                                autoAdjustQuality: quality.auto,
                              },
                            });

                            const currentMs = Math.floor((player.current?.getCurrentTime() ?? 0) * 1000);
                            seekToAfterLoad.current = currentMs / 1000;
                            reloadPlayer(loaded(currentMs));
                            setSettingsView('main');
                          }}
                          className={`w-full px-4 py-3 flex items-center justify-between hover:bg-white/10 transition-colors ${
                            !subtitleOptions.find(opt => opt.selected) ? 'bg-white/5' : ''
                          }`}
                        >
                          <span className="text-white">{t("watch.subtitlesOff")}</span>
                          {!subtitleOptions.find(opt => opt.selected) && (
                            <div className="w-2 h-2 rounded-full bg-plex"></div>
                          )}
                        </button>
                        {subtitleOptions.map((option) => (
                          <button
                            key={option.id}
                            onClick={async () => {
                              await ServerApi.subtitle({
                                part: metadata?.Media ? metadata?.Media[0].Part[0].id.toString() : "",
                                stream: option.id.toString(),
                              });
                              await loadMetadata(watch);
                              await ServerApi.decision({
                                id: watch,
                                limitation: {
                                  maxVideoBitrate: quality.bitrate,
                                  autoAdjustQuality: quality.auto,
                                },
                              });

                              const currentMs = Math.floor((player.current?.getCurrentTime() ?? 0) * 1000);
                              seekToAfterLoad.current = currentMs / 1000;
                              reloadPlayer(loaded(currentMs));
                              setSettingsView('main');
                            }}
                            className={`w-full px-4 py-3 flex items-center justify-between hover:bg-white/10 transition-colors ${
                              option.selected ? 'bg-white/5' : ''
                            }`}
                          >
                            <span className="text-white text-left">{option.extendedDisplayTitle}</span>
                            {option.selected && (
                              <div className="w-2 h-2 rounded-full bg-plex"></div>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </PopoverContent>
              </Popover>
              <button
                className="without-ring hover:bg-white/15 rounded-full p-1.5 transition-all"
                onKeyDown={(event) => {
                  if (event.key === " ") {
                    event.preventDefault();
                  }
                }}
                id="button-fullscreen"
              onClick={toggleFullscreenPlayer}
              >
                {document.fullscreenElement ? (
                  <Minimize className="w-5 h-5 sm:w-6 sm:h-6 text-white hover:scale-105 transition duration-150" />
                ) : (
                  <Maximize className="w-5 h-5 sm:w-6 sm:h-6 text-white hover:scale-105 transition duration-150" />
                )}
              </button>
              </div>
            </div>
            </div>
          </div>
        </>
      ) : (
        <div className="absolute inset-0 flex flex-row items-center justify-center">
          {metadata?.art && (
            <>
              <div className="absolute inset-0">
                <img
                  className="h-full object-cover blur-[3px]"
                  src={getCoverImage(metadata.art, true)}
                  alt={t("watch.metadataArtAlt")}
                />
              </div>
              <div className="absolute inset-0 bg-background/80"></div>
            </>
          )}
          <LoaderCircle
            strokeWidth={2}
            className="w-10 h-10 animate-spin-fast text-plex"
          />
        </div>
      )}
      <Dialog
        open={showError}
        onOpenChange={(open) => {
          if (!pendingRefresh) setShowError(open);
        }}
      >
        <DialogContent>
          <DialogTitle>{t("watch.loadingErrorTitle")}</DialogTitle>
          <DialogDescription>
            {t("watch.loadingErrorDescription")}
          </DialogDescription>
          <DialogFooter className="flex flex-row gap-2">
            <DialogClose asChild disabled={pendingRefresh}>
              <Button type="button" disabled={pendingRefresh}>
                {t("watch.close")}
              </Button>
            </DialogClose>
            <Button
              type="button"
              onClick={() => {
                setPendingRefresh(true);
                setTimeout(() => {
                  let t: string | number | null = searchParams.get("t");
                  if (t === null || parseInt(t) === 0) {
                    t = Math.floor(progress) * 1000;
                  }
                  router.replace(
                    `${pathname}?watch=${watch}${t ? `&t=${t}` : ""}`,
                    {
                      scroll: false,
                    },
                  );
                  setTimeout(() => {
                    window.location.reload();
                    setPendingRefresh(false);
                  }, 250);
                }, 2500);
              }}
              disabled={pendingRefresh}
            >
              {pendingRefresh ? (
                <LoaderCircle className="animate-spin" />
              ) : (
                t("watch.refresh")
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>,
    document.body,
  );
};

type WatchTranslate = (
  key: string,
  params?: Record<string, string | number | undefined | null>,
  fallback?: string,
) => string;

export function getCurrentVideoLevels(resolution: string, t?: WatchTranslate) {
  const levels: {
    title: string;
    bitrate?: number;
    extra: string;
    original?: boolean;
  }[] = [];

  const tr: WatchTranslate =
    t ??
    ((key, params) => {
      if (key === "watch.convertTo") return `Convert to ${params?.resolution ?? ""}`;
      if (key === "watch.qualityHigh") return `(High) ${params?.mbps ?? ""}Mbps`;
      if (key === "watch.qualityMedium") return `(Medium) ${params?.mbps ?? ""}Mbps`;
      if (key === "watch.qualityMbps") return `${params?.mbps ?? ""}Mbps`;
      return key;
    });

  const mk = (
    targetResolution: string,
    bitrate: number,
    label?: "high" | "medium",
    mbps?: string,
  ) => ({
    title: tr("watch.convertTo", { resolution: targetResolution }),
    bitrate,
    extra:
      label === "high"
        ? tr("watch.qualityHigh", { mbps })
        : label === "medium"
          ? tr("watch.qualityMedium", { mbps })
          : tr("watch.qualityMbps", { mbps }),
  });

  switch (resolution) {
    case "720":
      levels.push(
        ...[
          mk("720p", 4000, "high", "4"),
          mk("720p", 3000, "medium", "3"),
          mk("720p", 2000, undefined, "2"),
          mk("480p", 1500, undefined, "1.5"),
          mk("360p", 750, undefined, "0.7"),
          mk("240p", 300, undefined, "0.3"),
        ],
      );
      break;
    case "4k":
      levels.push(
        ...[
          mk("4K", 40000, "high", "40"),
          mk("4K", 30000, "medium", "30"),
          mk("4K", 20000, undefined, "20"),
          mk("1080p", 20000, "high", "20"),
          mk("1080p", 12000, "medium", "12"),
          mk("1080p", 10000, undefined, "10"),
          mk("720p", 4000, "high", "4"),
          mk("720p", 3000, "medium", "3"),
          mk("720p", 2000, undefined, "2"),
          mk("480p", 1500, undefined, "1.5"),
          mk("360p", 750, undefined, "0.7"),
          mk("240p", 300, undefined, "0.3"),
        ],
      );
      break;

    case "1080":
    default:
      levels.push(
        ...[
          mk("1080p", 20000, "high", "20"),
          mk("1080p", 12000, "medium", "12"),
          mk("1080p", 10000, undefined, "10"),
          mk("720p", 4000, "high", "4"),
          mk("720p", 3000, "medium", "3"),
          mk("720p", 2000, undefined, "2"),
          mk("480p", 1500, undefined, "1.5"),
          mk("360p", 750, undefined, "0.7"),
          mk("240p", 300, undefined, "0.3"),
        ],
      );
      break;
  }

  return levels;
}
