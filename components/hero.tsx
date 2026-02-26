"use client";

import { type CSSProperties, FC, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Info, Play, Star, Clock, Calendar } from "lucide-react";
import { ServerApi } from "@/api";
import { useQuery } from "@tanstack/react-query";
import { useHubItem } from "@/hooks/use-hub-item";
import { APPBAR_HEIGHT } from "@/components/appbar";
import { useSettings } from "@/components/settings-provider";
import { getContentLogo } from "@/lib/fanart";

export const Hero: FC<{ item: Plex.Metadata }> = ({ item }) => {
  const { disableClearLogo, t } = useSettings();
  const metadata = useQuery({
    queryKey: ["metadata", item.ratingKey],
    queryFn: async () => {
      return ServerApi.metadata({ id: item.ratingKey }).then((res) => res);
    },
  });

  const { play, coverImage, clearLogo, playable, open } = useHubItem(
    metadata.data ?? item,
    {
      fullSize: true,
    },
  );

  const summaryRef = useRef<HTMLParagraphElement | null>(null);
  const [summaryHeight, setSummaryHeight] = useState(0);
  const [fanartLogo, setFanartLogo] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    if (summaryRef.current && summaryHeight === 0) {
      setSummaryHeight(summaryRef.current.clientHeight);
    }
  }, []);

  // Load fanart.tv logo when there's no Plex clear logo
  useEffect(() => {
    if (!clearLogo && metadata.data) {
      getContentLogo(metadata.data).then((logo) => {
        if (logo) {
          setFanartLogo(logo);
        }
      });
    }
  }, [clearLogo, metadata.data]);

  const year = item.year;
  const rating = item.rating;
  const contentRating = item.contentRating;
  const duration = item.duration ? Math.round(item.duration / 60000) : null;
  const genres = item.Genre?.slice(0, 3);

  const displayLogo = clearLogo || fanartLogo;

  return (
    <div className="w-full flex flex-col items-start justify-start relative pb-4 md:pb-0">
      <div className="relative w-full h-[42svh] min-h-[260px] max-h-[420px] md:h-auto md:min-h-0 md:max-h-none overflow-hidden">
        <img
          className="w-full h-full md:h-auto top-0 object-cover object-center"
          src={coverImage}
          alt={t("hero.previewImageAlt")}
        />
        <div
          className="w-full h-full absolute top-0"
          style={{
            background:
              "linear-gradient(0, hsl(var(--background)), rgba(0, 0, 0, 0.7), rgba(0, 0, 0, 0.3), rgba(0, 0, 0, 0.05))",
          }}
        />
        <div
          className="w-full absolute top-0"
          style={{
            height: `calc(${APPBAR_HEIGHT}*5)`,
            background:
              "linear-gradient(to top, transparent, rgba(0,0,0,0.06), rgba(0,0,0,0.2), rgba(0,0,0,0.5), rgba(0,0,0,0.8))",
          }}
        />
      </div>
      <div className="relative z-20 -mt-14 sm:-mt-20 md:mt-0 md:absolute md:bottom-0 lg:bottom-[10vw] flex flex-col items-start justify-center px-4 sm:px-8 md:px-0 md:mx-20 gap-3 sm:gap-5 w-full md:w-auto">
        {/* Title / Logo */}
        <button
          onClick={() => open()}
          className="animate-float-up cursor-pointer z-20 relative max-w-full"
        >
          {!disableClearLogo && displayLogo ? (
            <img
              className="w-auto max-w-[82vw] sm:max-w-[70vw] md:max-w-[56vw] xl:max-w-[600px] max-h-[88px] sm:max-h-[130px] md:max-h-[200px] xl:max-h-[320px] h-full drop-shadow-2xl object-contain"
              src={displayLogo}
              alt={item.title}
            />
          ) : (
            <p
              className="font-bold text-xl sm:text-2xl md:text-3xl xl:text-4xl 2xl:text-5xl max-w-screen-lg line-clamp-2 md:line-clamp-3 lg:line-clamp-none drop-shadow-lg"
            >
              {item.title}
            </p>
          )}
        </button>

        {/* Glassmorphic metadata pills */}
        <div className="flex flex-row flex-wrap items-center gap-1.5 sm:gap-2 animate-float-up-delay-1 max-w-full">
          {rating && (
            <span className="glass-pill rounded-full px-2.5 sm:px-3 py-1 text-[11px] sm:text-xs font-semibold text-yellow-300/90 flex items-center gap-1 glass-glow-accent">
              <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
              {Number(rating).toFixed(1)}
            </span>
          )}
          {year && (
            <span className="glass-pill rounded-full px-2.5 sm:px-3 py-1 text-[11px] sm:text-xs font-semibold text-white/80 flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {year}
            </span>
          )}
          {duration && (
            <span className="glass-pill rounded-full px-2.5 sm:px-3 py-1 text-[11px] sm:text-xs font-semibold text-white/80 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {duration}m
            </span>
          )}
          {contentRating && (
            <span className="glass-pill rounded-full px-2.5 py-1 text-[10px] font-bold text-white/70 uppercase tracking-wider">
              {contentRating}
            </span>
          )}
          {genres?.map((genre) => (
            <span
              key={genre.tag}
              className="glass-pill rounded-full px-2.5 sm:px-3 py-1 text-[11px] sm:text-xs font-medium text-white/70"
            >
              {genre.tag}
            </span>
          ))}
        </div>

        {/* Summary in a glass card */}
        <div
          ref={summaryRef}
          className="glass rounded-2xl px-4 sm:px-5 py-3 max-w-[620px] glass-glow transition-all duration-300 animate-float-up-delay-2 w-full md:w-auto"
        >
          <p
            className={`font-medium text-sm sm:text-base text-white/85 leading-relaxed transition-all duration-300 ${
              isExpanded ? "" : "line-clamp-3"
            }`}
          >
            {item.summary}
          </p>
          {item.summary && item.summary.length > 150 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded(!isExpanded);
              }}
              className="mt-2 text-xs sm:text-sm font-semibold text-white/70 hover:text-white transition-colors flex items-center gap-1"
            >
              {isExpanded ? t("hero.readLess") : t("hero.readMore")}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={`transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}
              >
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </button>
          )}
        </div>

        {/* Glassmorphic action buttons */}
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 animate-float-up-delay-3 w-full md:w-auto">
          {metadata.data && (
            <button
              onClick={play}
              className="flex items-center justify-center gap-2.5 px-5 sm:px-7 py-3 rounded-2xl bg-white text-black font-bold text-sm sm:text-base hover:bg-white/90 hover:scale-[1.03] active:scale-[0.97] transition-all duration-200 shadow-lg shadow-white/20 w-full sm:w-auto"
            >
              <Play fill="currentColor" className="w-5 h-5" /> {t("hero.play")}
            </button>
          )}
          <button
            type="button"
            onClick={() => open()}
            className="flex items-center justify-center gap-2.5 px-5 sm:px-7 py-3 rounded-2xl glass-strong font-bold text-sm sm:text-base text-white hover:bg-white/20 hover:scale-[1.03] active:scale-[0.97] transition-all duration-200 glass-glow w-full sm:w-auto"
          >
            <Info className="w-5 h-5" /> {t("hero.moreInfo")}
          </button>
        </div>
      </div>
    </div>
  );
};
