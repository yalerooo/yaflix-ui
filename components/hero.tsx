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
  const { disableClearLogo } = useSettings();
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
    <div className="w-full flex flex-col items-start justify-start relative">
      <div className="relative w-full">
        <img className="w-full top-0" src={coverImage} alt="preview image" />
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
      <div className="flex flex-col items-start justify-center mx-10 md:mx-20 gap-5 absolute -bottom-[10vw] md:bottom-0 lg:bottom-[10vw]">
        {/* Title / Logo */}
        <button
          onClick={() => open()}
          className="animate-float-up cursor-pointer z-20 relative"
        >
          {!disableClearLogo && displayLogo ? (
            <img
              className={`min-w-[150px] w-auto max-w-[calc(100%-5rem)] lg:max-w-[60%] xl:max-w-[600px] max-h-[200px] xl:max-h-[320px] h-full drop-shadow-2xl`}
              src={displayLogo}
              alt={item.title}
            />
          ) : (
            <p
              className={`font-bold text-xl sm:text-2xl md:text-3xl xl:text-4xl 2xl:text-5xl max-w-screen-lg line-clamp-2 md:line-clamp-3 lg:line-clamp-none drop-shadow-lg`}
            >
              {item.title}
            </p>
          )}
        </button>

        {/* Glassmorphic metadata pills */}
        <div className="flex flex-row flex-wrap items-center gap-2 animate-float-up-delay-1">
          {rating && (
            <span className="glass-pill rounded-full px-3 py-1.5 text-xs font-semibold text-yellow-300/90 flex items-center gap-1.5 glass-glow-accent">
              <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
              {Number(rating).toFixed(1)}
            </span>
          )}
          {year && (
            <span className="glass-pill rounded-full px-3 py-1.5 text-xs font-semibold text-white/80 flex items-center gap-1.5">
              <Calendar className="w-3 h-3" />
              {year}
            </span>
          )}
          {duration && (
            <span className="glass-pill rounded-full px-3 py-1.5 text-xs font-semibold text-white/80 flex items-center gap-1.5">
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
              className="glass-pill rounded-full px-3 py-1.5 text-xs font-medium text-white/70"
            >
              {genre.tag}
            </span>
          ))}
        </div>

        {/* Summary in a glass card */}
        <div
          ref={summaryRef}
          className="glass rounded-2xl px-5 py-3 max-w-[620px] glass-glow transition-all duration-300 animate-float-up-delay-2"
        >
          <p className={`font-medium text-base text-white/85 leading-relaxed transition-all duration-300 ${isExpanded ? '' : 'line-clamp-3'}`}>
            {item.summary}
          </p>
          {item.summary && item.summary.length > 150 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded(!isExpanded);
              }}
              className="mt-2 text-sm font-semibold text-white/70 hover:text-white transition-colors flex items-center gap-1"
            >
              {isExpanded ? 'Leer menos' : 'Leer más'}
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
        <div className="flex flex-row gap-3 animate-float-up-delay-3">
          {metadata.data && (
            <button
              onClick={play}
              className="flex items-center gap-2.5 px-7 py-3 rounded-2xl bg-white text-black font-bold text-base hover:bg-white/90 hover:scale-[1.03] active:scale-[0.97] transition-all duration-200 shadow-lg shadow-white/20"
            >
              <Play fill="currentColor" className="w-5 h-5" /> Play
            </button>
          )}
          <button
            type="button"
            onClick={() => open()}
            className="flex items-center gap-2.5 px-7 py-3 rounded-2xl glass-strong font-bold text-base text-white hover:bg-white/20 hover:scale-[1.03] active:scale-[0.97] transition-all duration-200 glass-glow"
          >
            <Info className="w-5 h-5" /> More Info
          </button>
        </div>
      </div>
    </div>
  );
};
