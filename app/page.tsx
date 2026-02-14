"use client";

import { ServerApi } from "@/api";
import { useEffect, useState } from "react";
import { Hero } from "@/components/hero";
import { HubSlider } from "@/components/hub-slider";
import { useHubs } from "@/hooks/use-hubs";
import { useServer } from "@/components/server-provider";

export default function Home() {
  const [item, setItem] = useState<Plex.Metadata | null>(null);
  const [promoted, setPromoted] = useState<Plex.Hub[] | null>(null);
  const { hubs, reload, append } = useHubs(promoted);
  const [isLoading, setIsLoading] = useState(false);
  const { libraries, disabledLibraries } = useServer();

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
    <div className="w-full flex flex-col items-start justify-start relative">
      {item && <Hero item={item} />}
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
  );
}
