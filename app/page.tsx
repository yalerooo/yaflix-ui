"use client";

import { ServerApi } from "@/api";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Hero } from "@/components/hero";
import { HubSlider } from "@/components/hub-slider";
import { useHubs } from "@/hooks/use-hubs";
import { useServer } from "@/components/server-provider";
import { Skeleton } from "@/components/ui/skeleton";

function HomeSkeleton() {
  return (
    <div className="w-full flex flex-col">
      {/* Hero skeleton */}
      <div className="relative w-full">
        <Skeleton className="w-full h-[56vw] max-h-[700px] min-h-[320px] rounded-none" />
        {/* Gradient overlay to blend into background */}
        <div
          className="absolute bottom-0 left-0 w-full h-1/2 pointer-events-none"
          style={{ background: "linear-gradient(to top, hsl(var(--background)), transparent)" }}
        />
        {/* Logo + info skeleton */}
        <div className="absolute bottom-[10vw] left-0 mx-4 sm:mx-8 md:mx-20 flex flex-col gap-4">
          <Skeleton className="h-[60px] sm:h-[80px] md:h-[100px] w-[240px] sm:w-[320px] md:w-[420px] rounded-xl" />
          <div className="flex gap-2">
            {[80, 60, 72, 56].map((w, i) => (
              <Skeleton key={i} className={`h-6 rounded-full`} style={{ width: w }} />
            ))}
          </div>
          <Skeleton className="h-[72px] w-full max-w-[480px] rounded-2xl" />
          <div className="flex gap-3">
            <Skeleton className="h-12 w-28 rounded-2xl" />
            <Skeleton className="h-12 w-36 rounded-2xl" />
          </div>
        </div>
      </div>

      {/* Hub rows skeleton */}
      <div className="flex flex-col gap-6 px-10 -mt-8 relative z-10">
        {[0, 1, 2].map((row) => (
          <div key={row} className="flex flex-col gap-3">
            <Skeleton className="h-5 w-36 rounded-md" />
            <div className="flex gap-3 overflow-hidden">
              {Array.from({ length: 9 }).map((_, i) => (
                <Skeleton
                  key={i}
                  className="flex-shrink-0 aspect-video rounded-xl w-1/3 sm:w-1/4 md:w-1/5 lg:w-1/6 xl:w-[calc(100%/7)]"
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Home() {
  const [item, setItem] = useState<Plex.Metadata | null>(null);
  const [promoted, setPromoted] = useState<Plex.Hub[] | null>(null);
  const { hubs, reload, append } = useHubs(promoted);
  const [isLoading, setIsLoading] = useState(false);
  const [heroReady, setHeroReady] = useState(false);
  const [showSkeleton, setShowSkeleton] = useState(true);
  const { libraries, disabledLibraries } = useServer();
  const searchParams = useSearchParams();
  const isDialogOpen = !!searchParams.get("mid");

  useEffect(() => {
    if (heroReady) {
      const t = setTimeout(() => setShowSkeleton(false), 550);
      return () => clearTimeout(t);
    }
  }, [heroReady]);

  const handleUpdate = (
    updatedItem: Plex.HubMetadata,
    _: number,
    hubIndex: number,
  ) => {
    const hubsIndex = [hubIndex];
    const keys = [updatedItem.ratingKey];
    if (updatedItem.parentRatingKey) keys.push(updatedItem.parentRatingKey);
    if (updatedItem.grandparentRatingKey)
      keys.push(updatedItem.grandparentRatingKey);
    hubs?.forEach((hub, index) => {
      if (hubIndex === index) return;
      const included = hub.Metadata?.some((item) => {
        return keys.includes(item.ratingKey);
      });
      if (
        included ||
        hub.context.includes("recentlyviewed") ||
        hub.context.includes("inprogress")
      ) {
        hubsIndex.push(index);
      }
    });
    hubsIndex.forEach((index) => {
      reload(index);
    });
  };

  useEffect(() => {
    setIsLoading(true);
    const dirs = libraries
      .filter((a) => !disabledLibraries[a.title])
      .map((a) => a.key);
    (async () => {
      if (dirs.length > 0) {
        const item = await ServerApi.random({ dir: dirs });
        setItem(item);
      } else {
        setHeroReady(true);
      }
      const promo: Plex.Hub[] = [];
      ServerApi.continue({ dirs }).then(async (res) => {
        if (!res) return;
        if (res.length === 0) return;
        promo.push(res[0]);
        for (const dir of dirs) {
          const res = await ServerApi.promoted({ dir, dirs });
          if (!res) continue;
          if (res.length === 0) continue;
          res.forEach((hub) => {
            promo.push(hub);
          });
        }
        setPromoted(promo);
      });
      setIsLoading(false);
    })();

    const updateHubs = (event: PopStateEvent) => {
      const storage = localStorage.getItem("from-meta-screen");
      if (storage) {
        const { ratingKey, parentRatingKey, grandparentRatingKey } = JSON.parse(
          storage,
        ) as {
          ratingKey: string;
          parentRatingKey: string | null;
          grandparentRatingKey: string | null;
        };
        const hubsIndex: number[] = [];
        const keys = [ratingKey];
        if (parentRatingKey) keys.push(parentRatingKey);
        if (grandparentRatingKey) keys.push(grandparentRatingKey);
        hubs?.forEach((hub, index) => {
          const included = hub.Metadata?.some((item) =>
            keys.includes(item.ratingKey),
          );
          if (
            included ||
            hub.context.includes("recentlyviewed") ||
            hub.context.includes("inprogress")
          ) {
            hubsIndex.push(index);
          }
        });
        hubsIndex.forEach((index) => {
          reload(index);
        });
      }
      localStorage.removeItem("from-meta-screen");
    };

    window.addEventListener("popstate", updateHubs);
    return () => {
      window.removeEventListener("popstate", updateHubs);
    };
  }, []);

  if (isLoading) {
    return null;
  }

  return (
    <div className="relative w-full">
      {/* Skeleton — visible until hero is ready, then fades out and unmounts */}
      {showSkeleton && !isDialogOpen && (
        <div
          className="absolute inset-0 z-50 transition-opacity duration-500"
          style={{
            opacity: heroReady ? 0 : 1,
            pointerEvents: heroReady ? "none" : "auto",
          }}
          aria-hidden={heroReady}
        >
          <HomeSkeleton />
        </div>
      )}

      {/* Real content — fades in once ready */}
      <div
        className="w-full flex flex-col items-start justify-start transition-opacity duration-500"
        style={{ opacity: heroReady ? 1 : 0 }}
      >
        {item && <Hero item={item} onReady={() => setHeroReady(true)} />}
        {item && (
          <div className="flex flex-col items-start justify-start w-full z-10 lg:-mt-[calc(10vw-4rem)] md:mt-[3rem] -mt-[calc(-10vw-2rem)] gap-2">
            {hubs &&
              hubs.map((item, i) => (
                <HubSlider
                  onUpdate={(updatedItem, itemIndex) =>
                    handleUpdate(updatedItem, itemIndex, i)
                  }
                  onAppend={(updatedItems) => append(i, updatedItems)}
                  key={`${item.key}-${i}`}
                  hub={item}
                />
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
